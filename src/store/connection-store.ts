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
    parentId?: string | null;
    links: ConnectionLink[];
    createdAt: string;
    updatedAt: string;
}

interface ConnectionStore {
    folders: ConnectionFolder[];
    trashedFolders: ConnectionFolder[];
    isLoading: boolean;
    error: string | null;
    fetchFolders: (trashed?: boolean) => Promise<void>;
    addFolder: (name: string, color?: string, parentId?: string | null) => Promise<void>;
    updateFolder: (id: string, name: string, color?: string, parentId?: string | null) => Promise<void>;
    trashFolder: (id: string) => Promise<void>;
    restoreFolder: (id: string) => Promise<void>;
    permanentDeleteFolder: (id: string) => Promise<void>;
    addLink: (data: Omit<ConnectionLink, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateLink: (id: string, data: Partial<Omit<ConnectionLink, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
    trashLink: (id: string) => Promise<void>;
    restoreLink: (id: string) => Promise<void>;
    permanentDeleteLink: (id: string) => Promise<void>;
    toggleFavorite: (link: ConnectionLink) => Promise<void>;
    
    // Dialog state
    isFolderDialogOpen: boolean;
    isLinkDialogOpen: boolean;
    editingFolder: ConnectionFolder | null;
    editingLink: ConnectionLink | null;
    setFolderDialogOpen: (open: boolean, folder?: ConnectionFolder | null) => void;
    setLinkDialogOpen: (open: boolean, link?: ConnectionLink | null) => void;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
    folders: [],
    trashedFolders: [],
    isLoading: false,
    error: null,
    isFolderDialogOpen: false,
    isLinkDialogOpen: false,
    editingFolder: null,
    editingLink: null,
    
    setFolderDialogOpen: (open, folder = null) => set({ isFolderDialogOpen: open, editingFolder: folder }),
    setLinkDialogOpen: (open, link = null) => set({ isLinkDialogOpen: open, editingLink: link }),

    fetchFolders: async (trashed = false) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get(`/connections/folders?trashed=${trashed}`);
            if (trashed) {
                set({ trashedFolders: response.data, isLoading: false });
            } else {
                set({ folders: response.data, isLoading: false });
            }
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    addFolder: async (name, color, parentId) => {
        try {
            const response = await api.post('/connections/folders', { name, color, parentId });
            set((state) => ({ folders: [...state.folders, { ...response.data, links: [] }] }));
        } catch (error: any) {
            console.error('Failed to add folder:', error);
        }
    },

    updateFolder: async (id, name, color, parentId) => {
        try {
            const response = await api.put(`/connections/folders/${id}`, { name, color, parentId });
            set((state) => ({
                folders: state.folders.map((f) => f.id === id ? { ...f, ...response.data } : f)
            }));
        } catch (error: any) {
            console.error('Failed to update folder:', error);
        }
    },

    trashFolder: async (id) => {
        try {
            await api.put(`/connections/folders/${id}/trash`);
            set((state) => ({
                folders: state.folders.filter((f) => f.id !== id)
            }));
        } catch (error: any) {
            console.error('Failed to trash folder:', error);
        }
    },

    restoreFolder: async (id) => {
        try {
            await api.put(`/connections/folders/${id}/restore`);
            set((state) => ({
                trashedFolders: state.trashedFolders.filter((f) => f.id !== id)
            }));
            get().fetchFolders(false); // Refresh active folders
        } catch (error: any) {
            console.error('Failed to restore folder:', error);
        }
    },

    permanentDeleteFolder: async (id) => {
        try {
            await api.delete(`/connections/folders/${id}/permanent`);
            set((state) => ({
                trashedFolders: state.trashedFolders.filter((f) => f.id !== id)
            }));
        } catch (error: any) {
            console.error('Failed to permanently delete folder:', error);
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

    trashLink: async (id) => {
        try {
            await api.put(`/connections/links/${id}/trash`);
            set((state) => ({
                folders: state.folders.map((f) => ({
                    ...f,
                    links: f.links.filter((l) => l.id !== id)
                }))
            }));
        } catch (error: any) {
            console.error('Failed to trash link:', error);
        }
    },

    restoreLink: async (id) => {
        try {
            await api.put(`/connections/links/${id}/restore`);
            set((state) => ({
                trashedFolders: state.trashedFolders.map((f) => ({
                    ...f,
                    links: f.links.filter((l) => l.id !== id)
                }))
            }));
            get().fetchFolders(false); // Refresh active folders
        } catch (error: any) {
            console.error('Failed to restore link:', error);
        }
    },

    permanentDeleteLink: async (id) => {
        try {
            await api.delete(`/connections/links/${id}/permanent`);
            set((state) => ({
                trashedFolders: state.trashedFolders.map((f) => ({
                    ...f,
                    links: f.links.filter((l) => l.id !== id)
                }))
            }));
        } catch (error: any) {
            console.error('Failed to permanently delete link:', error);
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
