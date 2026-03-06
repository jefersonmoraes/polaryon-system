import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

export type UserRole = 'ADMIN' | 'USER';

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

    // Actions
    login: (email: string, rememberMe?: boolean) => boolean;
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

                    const updatedUser = { ...state.currentUser, ...updates };

                    // Also update the user in the systemUsers array to keep them in sync
                    const updatedSystemUsers = state.systemUsers.map(u =>
                        u.id === state.currentUser?.id ? updatedUser : u
                    );

                    return {
                        currentUser: updatedUser,
                        systemUsers: updatedSystemUsers
                    };
                });
            },

            addUser: (user) => {
                set((state) => ({
                    systemUsers: [
                        ...state.systemUsers,
                        {
                            ...user,
                            id: crypto.randomUUID(),
                            createdAt: new Date().toISOString()
                        }
                    ]
                }));
            },

            updateUser: (id, updates) => {
                set((state) => ({
                    systemUsers: state.systemUsers.map(u =>
                        u.id === id ? { ...u, ...updates } : u
                    ),
                    // If the updated user is the current user, update currentUser too
                    currentUser: state.currentUser?.id === id
                        ? { ...state.currentUser, ...updates }
                        : state.currentUser
                }));
            },

            removeUser: (id) => {
                set((state) => ({
                    systemUsers: state.systemUsers.filter(u => u.id !== id)
                }));
            }
        }),
        {
            name: 'kunbun-auth-storage',
            storage: createJSONStorage(() => authStorage),
        }
    )
);
