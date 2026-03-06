import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

interface AuthState {
    currentUser: SystemUser | null;
    systemUsers: SystemUser[];
    isAuthenticated: boolean;

    // Actions
    login: (email: string) => boolean;
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

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            currentUser: null,
            systemUsers: [DEFAULT_ADMIN], // Start with the default admin
            isAuthenticated: false,

            login: (email: string) => {
                const { systemUsers } = get();
                const user = systemUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.status === 'active');

                if (user) {
                    set({ currentUser: user, isAuthenticated: true });
                    return true;
                }
                return false;
            },

            logout: () => {
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
            // Omit functions and specify what to persist if needed, but Zustand does this by default
        }
    )
);
