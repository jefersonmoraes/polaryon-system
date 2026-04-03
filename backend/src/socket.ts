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
    const userProfiles = new Map<string, { name: string, picture?: string }>(); // userId -> profile details

    const broadcastOnlineUsers = () => {
        const userIds = Array.from(new Set(onlineUsers.values()));
        io.emit('online_users', userIds);
    };

    io.on('connection', (socket: Socket) => {
        console.log(`🔌 Client Connected: ${socket.id}`);

        // Handle user identification for presence with profile data
        socket.on('user_join', (userData: { id: string, name: string, picture?: string }) => {
            if (userData && userData.id) {
                const userId = userData.id;
                
                // If it's the first connection for this user ID, notify others
                const existingConnections = Array.from(onlineUsers.values()).filter(id => id === userId).length;
                
                onlineUsers.set(socket.id, userId);
                userProfiles.set(userId, { name: userData.name, picture: userData.picture });
                
                broadcastOnlineUsers();
                
                if (existingConnections === 0) {
                    console.log(`🔔 User Join Notify: ${userData.name}`);
                    socket.broadcast.emit('user_presence_connect', { 
                        id: userId, 
                        name: userData.name, 
                        picture: userData.picture 
                    });
                }
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
            const userId = onlineUsers.get(socket.id);
            if (userId) {
                onlineUsers.delete(socket.id);
                
                // If this was the last connection for this user ID, notify others
                const remainingConnections = Array.from(onlineUsers.values()).filter(id => id === userId).length;
                
                if (remainingConnections === 0) {
                    const profile = userProfiles.get(userId);
                    console.log(`🔕 User Leave Notify: ${profile?.name || userId}`);
                    socket.broadcast.emit('user_presence_disconnect', { 
                        id: userId, 
                        name: profile?.name || 'Usuário',
                        picture: profile?.picture 
                    });
                    // Optional: delay cleanup to handle rapid refresh
                    userProfiles.delete(userId);
                }
                
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
