import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server;

export const initSocket = (server: HttpServer) => {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    const onlineUsers = new Map<string, string>(); // socket.id -> userId

    const broadcastOnlineUsers = () => {
        const userIds = Array.from(new Set(onlineUsers.values()));
        io.emit('online_users', userIds);
    };

    io.on('connection', (socket: Socket) => {
        console.log(`🔌 Client Connected: ${socket.id}`);

        // Handle user identification for presence
        socket.on('user_join', (userId: string) => {
            if (userId) {
                onlineUsers.set(socket.id, userId);
                broadcastOnlineUsers();
                console.log(`👤 User ${userId} joined (Socket: ${socket.id})`);
            }
        });

        socket.on('kanban_action', (data) => {
            // Emits to all OTHER clients
            socket.broadcast.emit('kanban_sync', data);
        });

        socket.on('system_action', (data) => {
            // Generic broadcast for other stores (Accounting, Docs, etc)
            socket.broadcast.emit('system_sync', data);
        });

        socket.on('disconnect', () => {
            if (onlineUsers.has(socket.id)) {
                onlineUsers.delete(socket.id);
                broadcastOnlineUsers();
            }
            console.log(`🔌 Client Disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};
