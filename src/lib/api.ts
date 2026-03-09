// Create central Axios instance
const api = axios.create({
    baseURL: 'https://polaryon.com.br/api', // Produção: Domínio Oficial HTTPS
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
    (config) => {
        // Retrieve token from whatever auth store mechanism you are using
        // It could be sessionStorage or zustand. We'll read from sessionStorage to be safe.
        const authDataStr = sessionStorage.getItem('auth-storage');
        if (authDataStr) {
            try {
                const state = JSON.parse(authDataStr).state;
                if (state && state.token) {
                    config.headers.Authorization = `Bearer ${state.token}`;
                }
            } catch (e) {
                console.error("Error parsing auth-storage", e);
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle 401/403 globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid
            console.error('Session expired or unauthorized');
            // If you want to automatically log out here, you could dispatch an event
            // or call a store method.
        }
        return Promise.reject(error);
    }
);

export default api;
