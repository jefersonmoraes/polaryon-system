import { io, Socket } from 'socket.io-client';

/**
 * CRITICAL PRODUCTION CONFIGURATION: DO NOT REMOVE OR ALTER WITHOUT AUTHORIZATION.
 * This logic ensures the WebSocket connects to the correct origin in production (VPS).
 */
const getSocketURL = () => {
    const isProd = import.meta.env.PROD;
    const envUrl = import.meta.env.VITE_API_URL;
    
    if (isProd) {
        // In production, always use the current domain to ensure WebSocket connectivity through Nginx proxy
        return window.location.origin;
    }
    
    // Development fallback
    const url = envUrl || 'http://localhost:3000';
    if (url === '/api') return window.location.origin;
    return url.replace(/\/api$/, '');
};

const BACKEND_URL = getSocketURL();

class SocketService {
    private socket: Socket | null = null;
    private listeners: Record<string, Function[]> = {};

    connect() {
        if (!this.socket) {
            this.socket = io(BACKEND_URL, {
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                transports: ['websocket', 'polling'] // Try websocket first
            });

            this.socket.on('connect', () => {
                console.log('🔗 Connected to realtime server');
                this.trigger('connection_change', true);
            });

            this.socket.on('kanban_sync', (data) => {
                this.trigger('kanban_sync', data);
            });

            this.socket.on('system_sync', (data) => {
                this.trigger('system_sync', data);
            });

            this.socket.on('online_users', (data) => {
                this.trigger('online_users', data);
            });

            this.socket.on('user_presence_connect', (data) => {
                this.trigger('user_presence_connect', data);
            });

            this.socket.on('user_presence_disconnect', (data) => {
                this.trigger('user_presence_disconnect', data);
            });

            this.socket.on('biddingUpdate', (data) => {
                this.trigger('biddingUpdate', data);
            });

            this.socket.on('disconnect', () => {
                console.log('❌ Disconnected from realtime server');
                this.trigger('connection_change', false);
            });

            this.socket.on('connect_error', () => {
                this.trigger('connection_change', false);
            });
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    emit(event: string, data: any) {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }

    on(event: string, callback: Function) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event: string, callback: Function) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    private trigger(event: string, data: any) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}

export const socketService = new SocketService();
