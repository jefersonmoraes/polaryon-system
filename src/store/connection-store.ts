import { create } from 'zustand';
import api from '@/lib/api';

export interface ConnectionLink {
    id: string;
    title: string;
    url: string;
    description: string | null;
    isFavorite: boolean;
    folderId: string;
    createdAt: string;
    updatedAt: string;
}

export interface ConnectionFolder {
    id: string;
    name: string;
    color: string | null;
    links: ConnectionLink[];
    createdAt: string;
    updatedAt: string;
}

interface ConnectionStore {
    folders: ConnectionFolder[];
    isLoading: boolean;
    error: string | null;
    fetchFolders: () => Promise<void>;
    addFolder: (name: string, color?: string) => Promise<void>;
    updateFolder: (id: string, name: string, color?: string) => Promise<void>;
    deleteFolder: (id: string) => Promise<void>;
    addLink: (data: Omit<ConnectionLink, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateLink: (id: string, data: Partial<Omit<ConnectionLink, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
    deleteLink: (id: string) => Promise<void>;
    toggleFavorite: (link: ConnectionLink) => Promise<void>;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
    folders: [],
    isLoading: false,
    error: null,

    fetchFolders: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get('/connections/folders');
            set({ folders: response.data, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    addFolder: async (name, color) => {
        try {
            const response = await api.post('/connections/folders', { name, color });
            set((state) => ({ folders: [...state.folders, { ...response.data, links: [] }] }));
        } catch (error: any) {
            console.error('Failed to add folder:', error);
        }
    },

    updateFolder: async (id, name, color) => {
        try {
            const response = await api.put(`/connections/folders/${id}`, { name, color });
            set((state) => ({
                folders: state.folders.map((f) => f.id === id ? { ...f, ...response.data } : f)
            }));
        } catch (error: any) {
            console.error('Failed to update folder:', error);
        }
    },

    deleteFolder: async (id) => {
        try {
            await api.delete(`/connections/folders/${id}`);
            set((state) => ({ folders: state.folders.filter((f) => f.id !== id) }));
        } catch (error: any) {
            console.error('Failed to delete folder:', error);
        }
    },

    addLink: async (linkData) => {
        try {
            const response = await api.post('/connections/links', linkData);
            const newLink = response.data;
            set((state) => ({
                folders: state.folders.map((f) => 
                    f.id === linkData.folderId ? { ...f, links: [...f.links, newLink] } : f
                )
            }));
        } catch (error: any) {
            console.error('Failed to add link:', error);
        }
    },

    updateLink: async (id, linkData) => {
        try {
            const response = await api.put(`/connections/links/${id}`, linkData);
            const updatedLink = response.data;
            set((state) => ({
                folders: state.folders.map((f) => ({
                    ...f,
                    links: f.links.map((l) => l.id === id ? updatedLink : l)
                }))
            }));
        } catch (error: any) {
            console.error('Failed to update link:', error);
        }
    },

    deleteLink: async (id) => {
        try {
            await api.delete(`/connections/links/${id}`);
            set((state) => ({
                folders: state.folders.map((f) => ({
                    ...f,
                    links: f.links.filter((l) => l.id !== id)
                }))
            }));
        } catch (error: any) {
            console.error('Failed to delete link:', error);
        }
    },

    toggleFavorite: async (link) => {
        try {
            const response = await api.put(`/connections/links/${link.id}`, { isFavorite: !link.isFavorite });
            const updatedLink = response.data;
            set((state) => ({
                folders: state.folders.map((f) => ({
                    ...f,
                    links: f.links.map((l) => l.id === link.id ? updatedLink : l)
                }))
            }));
        } catch (error: any) {
            console.error('Failed to toggle favorite:', error);
        }
    }
}));
