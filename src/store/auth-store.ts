import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { useAuditStore } from './audit-store';

export type UserRole = 'ADMIN' | 'USER' | 'CONTADOR';

export interface UserPermissions {
    canView: boolean;
    canEdit: boolean;
    canDownload: boolean;
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
    'jefersonvilela72@gmail.com'
];

interface AuthState {
    currentUser: SystemUser | null;
    systemUsers: SystemUser[];
    isAuthenticated: boolean;
    jwtToken: string | null;

    // Actions
    login: (email: string, rememberMe?: boolean) => boolean;
    loginWithGoogle: (userData: SystemUser, token: string) => void;
    logout: () => void;
    updateProfile: (updates: Partial<SystemUser>) => void;

    // Admin Actions
    addUser: (user: Omit<SystemUser, 'id' | 'createdAt'>) => void;
    updateUser: (id: string, updates: Partial<SystemUser>) => void;
    removeUser: (id: string) => void;
}

const DEFAULT_ADMIN: SystemUser = {
    id: 'admin-1',
    email: 'admin@polaryon.com', // Fake admin email to bootstrap the system
    name: 'Administrador Polaryon',
    role: 'ADMIN',
    permissions: {
        canView: true,
        canEdit: true,
        canDownload: true
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

            loginWithGoogle: (userData: SystemUser, token: string) => {
                set({
                    currentUser: userData,
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
                                permissions: { canView: true, canEdit: true, canDownload: true }
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
                            permissions: { canView: true, canEdit: true, canDownload: true },
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

                    return {
                        systemUsers: [
                            ...state.systemUsers,
                            {
                                ...user,
                                id: newId,
                                createdAt: new Date().toISOString()
                            }
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
                    }

                    return {
                        systemUsers: state.systemUsers.map(u =>
                            u.id === id ? { ...u, ...updates } : u
                        ),
                        // If the updated user is the current user, update currentUser too
                        currentUser: state.currentUser?.id === id
                            ? { ...state.currentUser, ...updates }
                            : state.currentUser
                    };
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
                            details: `Removeu o usuário ${targetUser.name}`
                        });
                    }

                    return {
                        systemUsers: state.systemUsers.filter(u => u.id !== id)
                    };
                });
            }
        }),
        {
            name: 'kunbun-auth-storage',
            storage: createJSONStorage(() => authStorage),
        }
    )
);
