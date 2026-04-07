import axios from 'axios';

// Create central Axios instance
const isProd = import.meta.env.PROD;
const api = axios.create({
    baseURL: isProd ? '/api' : `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000/api`,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
    (config) => {
        // Retrieve token from whatever auth store mechanism you are using
        // It could be sessionStorage or zustand. We'll read from sessionStorage to be safe.
        const authDataStr = localStorage.getItem('polaryon-auth-v2');
        if (authDataStr) {
            try {
                const state = JSON.parse(authDataStr).state;
                if (state && state.jwtToken) {
                    config.headers.Authorization = `Bearer ${state.jwtToken}`;
                }
            } catch (e) {
                console.error("Error parsing polaryon-auth-v2", e);
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle 401/403 globally and catch Data Loss errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid
            console.error('Session expired or unauthorized (401)');
            
            // SECURITY: Only wipe and redirect if we are not already on the login page
            // and if this isn't a false positive from a background check.
            if (!window.location.pathname.startsWith('/login')) {
                import('sonner').then(({ toast }) => {
                    toast.error('Sua sessão expirou por segurança.', {
                        description: 'Clique para entrar novamente e continuar seu trabalho.',
                        duration: 15000,
                        id: 'session-expired-error',
                        action: {
                            label: 'Entrar',
                            onClick: () => {
                                // Clean up old v2 data to avoid quota issues
                                localStorage.removeItem('polaryon-auth-v2');
                                sessionStorage.removeItem('polaryon-auth-v2');
                                window.location.href = '/login?expired=true';
                            }
                        }
                    });
                });
            }
        }
        
        // Data Loss Protection: Alert user if a write operation failed
        const isCalendarRoute = error.config && error.config.url && ['/calendar/sync', '/calendar/events'].some(url => error.config.url.includes(url));
        const isUnauthorized = error.response && error.response.status === 401;
        
        if (error.config && error.config.method && ['post', 'put', 'delete', 'patch'].includes(error.config.method.toLowerCase()) && !isCalendarRoute && !isUnauthorized) {
            console.error('Data persistence failure:', error);
            // Dynamic import to avoid circular dependency issues at boot
            import('sonner').then(({ toast }) => {
                toast.error('Erro de conexão ou servidor. Os últimos dados podem não ter sido salvos. Verifique e tente novamente.', {
                    duration: 6000,
                    id: 'global-persistence-error' // Prevent spamming
                });
            });
        }
        
        return Promise.reject(error);
    }
);

export default api;
