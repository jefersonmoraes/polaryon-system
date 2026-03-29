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
        const authDataStr = sessionStorage.getItem('polaryon-auth-v2') || localStorage.getItem('polaryon-auth-v2');
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
            console.error('Session expired or unauthorized');
            // If you want to automatically log out here, you could dispatch an event
            // or call a store method.
        }
        
        // Data Loss Protection: Alert user if a write operation failed
        const isSilentRoute = error.config && error.config.url && ['/calendar/sync', '/calendar/events'].some(url => error.config.url.includes(url));
        
        if (error.config && error.config.method && ['post', 'put', 'delete', 'patch'].includes(error.config.method.toLowerCase()) && !isSilentRoute) {
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
