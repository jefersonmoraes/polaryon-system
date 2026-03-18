import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { useAuditStore } from './audit-store';
import api from '@/lib/api';
import { socketService } from '@/lib/socket';

export type UserRole = 'ADMIN' | 'USER' | 'CONTADOR';

export interface UserPermissions {
    canView: boolean;
    canEdit: boolean;
    canDownload: boolean;
    allowedScreens?: string[];
}

export interface SystemUser {
    id: string;
    email: string;
    name: string;
    photoURL?: string;
    role: UserRole;
    permissions: UserPermissions;
    status: 'active' | 'invited' | 'disabled';
    createdAt: string;
}

export const AUTO_ADMIN_EMAILS = [
    'jjcorporation2018@gmail.com',
    'jefersonvilela72@gmail.com',
    'jeferson99jeferson@gmail.com'
];

interface AuthState {
    currentUser: SystemUser | null;
    systemUsers: SystemUser[];
    isAuthenticated: boolean;
    jwtToken: string | null;

    // Actions
    login: (email: string, rememberMe?: boolean) => boolean;
    loginWithGoogle: (userData: SystemUser, token: string, rememberMe?: boolean) => void;
    logout: () => void;
    updateProfile: (updates: Partial<SystemUser>) => void;

    // Admin Actions
    addUser: (user: Omit<SystemUser, 'id' | 'createdAt'>) => void;
    updateUser: (id: string, updates: Partial<SystemUser>) => void;
    removeUser: (id: string) => void;
    hasScreenAccess: (screenId: string) => boolean;
    onlineUsers: string[];
    setOnlineUsers: (userIds: string[]) => void;
}

const DEFAULT_ADMIN: SystemUser = {
    id: 'admin-1',
    email: 'admin@polaryon.com', // Fake admin email to bootstrap the system
    name: 'Administrador Polaryon',
    role: 'ADMIN',
    permissions: {
        canView: true,
        canEdit: true,
        canDownload: true,
        allowedScreens: ['ALL']
    },
    status: 'active',
    createdAt: new Date().toISOString()
};

const authStorage: StateStorage = {
    getItem: (name) => {
        return sessionStorage.getItem(name) || localStorage.getItem(name);
    },
    setItem: (name, value) => {
        if (localStorage.getItem('rememberMe') === 'true') {
            localStorage.setItem(name, value);
            sessionStorage.removeItem(name);
        } else {
            sessionStorage.setItem(name, value);
            localStorage.removeItem(name);
        }
    },
    removeItem: (name) => {
        sessionStorage.removeItem(name);
        localStorage.removeItem(name);
    }
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            currentUser: null,
            systemUsers: [DEFAULT_ADMIN], // Start with the default admin
            isAuthenticated: false,
            jwtToken: null,
            onlineUsers: [],

            setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),

            loginWithGoogle: (userData: SystemUser, token: string, rememberMe = false) => {
                const { systemUsers } = get();
                const normalizedEmail = userData.email.toLowerCase().trim();
                const isAdminEmail = AUTO_ADMIN_EMAILS.includes(normalizedEmail);

                let finalUserData = { ...userData };

                // --- Force Admin Status for Authorized Emails ---
                if (isAdminEmail) {
                    finalUserData = {
                        ...finalUserData,
                        role: 'ADMIN',
                        permissions: { ...finalUserData.permissions, allowedScreens: ['ALL'] }
                    };
                }

                const existingIndex = systemUsers.findIndex(u => u.email.toLowerCase() === normalizedEmail);
                let newSystemUsers = [...systemUsers];
                
                if (existingIndex >= 0) {
                    const mergedUser = { ...newSystemUsers[existingIndex], ...finalUserData };
                    if (isAdminEmail) {
                        mergedUser.role = 'ADMIN';
                        mergedUser.permissions = { ...mergedUser.permissions, allowedScreens: ['ALL'] };
                    }
                    newSystemUsers[existingIndex] = mergedUser;
                    finalUserData = mergedUser;
                } else {
                    newSystemUsers.push(finalUserData);
                }

                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true');
                } else {
                    localStorage.removeItem('rememberMe');
                }

                set({
                    currentUser: finalUserData,
                    systemUsers: newSystemUsers,
                    isAuthenticated: true,
                    jwtToken: token
                });
            },

            login: (email: string, rememberMe = false) => {
                const { systemUsers, addUser, updateUser } = get();
                const normalizedEmail = email.toLowerCase().trim();

                const isAdminEmail = AUTO_ADMIN_EMAILS.includes(normalizedEmail);
                let user = systemUsers.find(u => u.email.toLowerCase() === normalizedEmail);

                // --- Auto-Admin Interceptor Logic ---
                if (isAdminEmail) {
                    if (user) {
                        // User exists locally, but enforce ADMIN role and active status
                        if (user.role !== 'ADMIN' || user.status !== 'active' || !user.permissions.canEdit) {
                            user = {
                                ...user,
                                role: 'ADMIN',
                                status: 'active',
                                permissions: { canView: true, canEdit: true, canDownload: true, allowedScreens: ['ALL'] }
                            };
                            updateUser(user.id, user);
                        }
                    } else {
                        // User does not exist locally yet, create on the fly
                        const newAdmin: SystemUser = {
                            id: crypto.randomUUID(),
                            email: normalizedEmail,
                            name: normalizedEmail.split('@')[0], // Extract name from email as default
                            role: 'ADMIN',
                            status: 'active',
                            permissions: { canView: true, canEdit: true, canDownload: true, allowedScreens: ['ALL'] },
                            createdAt: new Date().toISOString()
                        };
                        addUser(newAdmin);
                        user = newAdmin;
                    }
                }

                // standard active user login check
                if (user && user.status === 'active') {
                    if (rememberMe) {
                        localStorage.setItem('rememberMe', 'true');
                    } else {
                        localStorage.removeItem('rememberMe');
                    }
                    set({ currentUser: user, isAuthenticated: true });

                    useAuditStore.getState().addLog({
                        userId: user.id,
                        userName: user.name,
                        action: 'LOGIN',
                        entity: 'USUÁRIO',
                        details: `Usuário acessou o sistema`
                    });

                    return true;
                }

                return false;
            },

            logout: () => {
                localStorage.removeItem('rememberMe');
                set({ currentUser: null, isAuthenticated: false });
            },

            updateProfile: (updates) => {
                set((state) => {
                    if (!state.currentUser) return state;

                    // SECURITY PATCH: Prevent Privilege Escalation
                    // Destructure and drop any sensitive fields the user might maliciously inject via console
                    const { role, permissions, status, createdAt, id, ...safeUpdates } = updates as any;

                    const updatedUser = { ...state.currentUser, ...safeUpdates };

                    // Also update the user in the systemUsers array to keep them in sync
                    const updatedSystemUsers = state.systemUsers.map(u =>
                        u.id === state.currentUser?.id ? updatedUser : u
                    );

                    useAuditStore.getState().addLog({
                        userId: state.currentUser.id,
                        userName: state.currentUser.name,
                        action: 'EDITAR',
                        entity: 'USUÁRIO',
                        details: `Atualizou o próprio perfil`
                    });

                    // Fire and forget API call to persist the profile changes to the backend
                    api.put(`/users/${state.currentUser.id}/profile`, {
                        name: safeUpdates.name,
                        picture: safeUpdates.photoURL
                    }).catch(err => console.error("Failed to update profile to backend:", err));

                    return {
                        currentUser: updatedUser,
                        systemUsers: updatedSystemUsers
                    };
                });
            },

            addUser: (user) => {
                set((state) => {
                    // SECURITY PATCH: Broken Access Control Guard
                    if (state.currentUser?.role !== 'ADMIN') return state;

                    const newId = crypto.randomUUID();

                    useAuditStore.getState().addLog({
                        userId: state.currentUser.id,
                        userName: state.currentUser.name,
                        action: 'CRIAR',
                        entity: 'USUÁRIO',
                        details: `Criou o usuário ${user.name} (${user.email})`
                    });

                    const newUser = {
                                ...user,
                                id: newId,
                                createdAt: new Date().toISOString()
                            };

                    socketService.emit('system_action', { store: 'AUTH', type: 'ADD_USER', payload: newUser });
                    
                    return {
                        systemUsers: [
                            ...state.systemUsers,
                            newUser
                        ]
                    };
                });
            },

            updateUser: (id, updates) => {
                set((state) => {
                    // SECURITY PATCH: Broken Access Control Guard
                    if (state.currentUser?.role !== 'ADMIN') return state;

                    const targetUser = state.systemUsers.find(u => u.id === id);

                    if (targetUser) {
                        useAuditStore.getState().addLog({
                            userId: state.currentUser.id,
                            userName: state.currentUser.name,
                            action: 'EDITAR',
                            entity: 'USUÁRIO',
                            details: `Editou permissões ou dados do usuário ${targetUser.name}`
                        });

                        socketService.emit('system_action', { store: 'AUTH', type: 'UPDATE_USER', payload: { id, updates } });

                        return {
                            systemUsers: state.systemUsers.map(u => u.id === id ? { ...u, ...updates } : u),
                            // If the updated user is the current user, update currentUser too
                            currentUser: state.currentUser?.id === id
                                ? { ...state.currentUser, ...updates }
                                : state.currentUser
                        };
                    }
                    return state;
                });
            },

            removeUser: (id) => {
                set((state) => {
                    // SECURITY PATCH: Broken Access Control Guard
                    if (state.currentUser?.role !== 'ADMIN') return state;

                    const targetUser = state.systemUsers.find(u => u.id === id);

                    if (targetUser) {
                        useAuditStore.getState().addLog({
                            userId: state.currentUser.id,
                            userName: state.currentUser.name,
                            action: 'EXCLUIR',
                            entity: 'USUÁRIO',
                            details: `Removeu o usuário ${targetUser.name} (${targetUser.email})`
                        });

                        socketService.emit('system_action', { store: 'AUTH', type: 'REMOVE_USER', payload: { id } });

                        return {
                            systemUsers: state.systemUsers.filter(u => u.id !== id)
                        };
                    }
                    return state;
                });
            },
            hasScreenAccess: (screenId: string) => {
                const { currentUser } = get();
                if (!currentUser) return false;
                
                const normalizedEmail = currentUser.email?.toLowerCase().trim();
                const isAutoAdmin = AUTO_ADMIN_EMAILS.includes(normalizedEmail);
                
                const role = currentUser.role?.toUpperCase();
                if (role === 'ADMIN' || isAutoAdmin) return true;
                
                if (currentUser.permissions?.allowedScreens?.includes('ALL')) return true;
                return currentUser.permissions?.allowedScreens?.includes(screenId) || false;
            },

            // Socket handler
            processSystemAction: (action: any) => {
                const { type, payload } = action;
                if (type === 'ADD_USER') {
                    set(s => ({ systemUsers: [...s.systemUsers, payload] }));
                } else if (type === 'UPDATE_USER') {
                    set(s => ({
                        systemUsers: s.systemUsers.map(u => u.id === payload.id ? { ...u, ...payload.updates } : u),
                        currentUser: s.currentUser?.id === payload.id ? { ...s.currentUser, ...payload.updates } : s.currentUser
                    }));
                } else if (type === 'REMOVE_USER') {
                    set(s => ({ systemUsers: s.systemUsers.filter(u => u.id !== payload.id) }));
                }
            }
        }),
        {
            name: 'polaryon-auth-v2',
            storage: createJSONStorage(() => authStorage)
        }
    )
);
