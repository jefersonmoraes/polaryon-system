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
    const pendingDisconnects = new Map<string, NodeJS.Timeout>(); // userId -> Timeout object

    const broadcastOnlineUsers = () => {
        const activeIds = Array.from(onlineUsers.values());
        const pendingIds = Array.from(pendingDisconnects.keys());
        const allOnlineIds = Array.from(new Set([...activeIds, ...pendingIds]));
        io.emit('online_users', allOnlineIds);
    };

    io.on('connection', (socket: Socket) => {
        console.log(`🔌 Client Connected: ${socket.id}`);

        // Handle user identification for presence with profile data
        socket.on('user_join', (userData: { id: string, name: string, picture?: string }) => {
            try {
                if (!userData || !userData.id) return;
                
                const userId = userData.id;
                
                // Reconnection check: Was this user already online (even if in grace period)?
                const isStillConnected = Array.from(onlineUsers.values()).some(id => id === userId);
                const wasWaitingToLeave = pendingDisconnects.has(userId);
                
                onlineUsers.set(socket.id, userId);
                userProfiles.set(userId, { name: userData.name || 'Usuário', picture: userData.picture });
                
                // CRITICAL: If they were in grace period, CANCEL the leave notice and DON'T send a join notice
                if (wasWaitingToLeave) {
                    console.log(`⏱️ DEBOUNCE: ${userData.name || userId} refreshed. Disconnect cancelled. Suppressing Join alert.`);
                    clearTimeout(pendingDisconnects.get(userId));
                    pendingDisconnects.delete(userId);
                } else if (!isStillConnected) {
                    // Only notify if they were NOT connected at all and NOT in grace period (real new session)
                    console.log(`🔔 User Join Notify: ${userData.name || userId}`);
                    socket.broadcast.emit('user_presence_connect', { 
                        id: userId, 
                        name: userData.name || 'Usuário', 
                        picture: userData.picture 
                    });
                }

                broadcastOnlineUsers();
            } catch (error) {
                console.error(`❌ Error in user_join:`, error);
            }
        });

        // HANDLE EXPLICIT LOGOUT (Immediate notification)
        socket.on('user_logout', () => {
            try {
                const userId = onlineUsers.get(socket.id);
                if (userId) {
                    const profile = userProfiles.get(userId);
                    console.log(`🚪 EXPLICIT LOGOUT: ${profile?.name || userId}`);
                    
                    // Clear any pending timeout just in case
                    if (pendingDisconnects.has(userId)) {
                        clearTimeout(pendingDisconnects.get(userId));
                        pendingDisconnects.delete(userId);
                    }

                    // Notify others IMMEDIATELY
                    socket.broadcast.emit('user_presence_disconnect', { 
                        id: userId, 
                        name: profile?.name || 'Usuário',
                        picture: profile?.picture 
                    });

                    // Cleanup connections for this socket
                    onlineUsers.delete(socket.id);
                    
                    // Check if totally offline before cleaning profile
                    const isStillOnline = Array.from(onlineUsers.values()).some(id => id === userId);
                    if (!isStillOnline) {
                        userProfiles.delete(userId);
                    }

                    broadcastOnlineUsers();
                }
            } catch (error) {
                console.error(`❌ Error in user_logout:`, error);
            }
        });

        socket.on('kanban_action', (data) => {
            try {
                // Emits to all OTHER clients
                socket.broadcast.emit('kanban_sync', data);
            } catch (error) {
                console.error(`❌ Error in kanban_action:`, error);
            }
        });

        socket.on('system_action', (data) => {
            try {
                // Generic broadcast for other stores (Accounting, Docs, etc)
                socket.broadcast.emit('system_sync', data);
            } catch (error) {
                console.error(`❌ Error in system_action:`, error);
            }
        });

        socket.on('disconnect', () => {
            try {
                const userId = onlineUsers.get(socket.id);
                if (userId) {
                    onlineUsers.delete(socket.id);
                    
                    // If this was the last connection for this user ID, schedule notify after grace period
                    const remainingConnections = Array.from(onlineUsers.values()).filter(id => id === userId).length;
                    
                    if (remainingConnections === 0) {
                        const profile = userProfiles.get(userId);
                        console.log(`⏱️ GRACE PERIOD: Scheduling leave notify for ${profile?.name || userId}`);
                        
                        const timeout = setTimeout(() => {
                            try {
                                console.log(`🔕 User Leave Notify EXPIRED: ${profile?.name || userId}`);
                                socket.broadcast.emit('user_presence_disconnect', { 
                                    id: userId, 
                                    name: profile?.name || 'Usuário',
                                    picture: profile?.picture 
                                });
                                userProfiles.delete(userId);
                                pendingDisconnects.delete(userId);
                                broadcastOnlineUsers();
                            } catch (e) {
                                console.error(`❌ Error in disconnect timeout callback:`, e);
                            }
                        }, 3000); // 3 seconds grace period

                        pendingDisconnects.set(userId, timeout);
                    }
                    
                    broadcastOnlineUsers();
                }
                console.log(`🔌 Client Disconnected: ${socket.id}`);
            } catch (error) {
                console.error(`❌ Error in disconnect:`, error);
            }
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
