import { create } from 'zustand';
import api from '@/lib/api';
import { socketService } from '@/lib/socket';

export interface ConnectionLink {
    id: string;
    title: string;
    url: string;
    description: string | null;
    isFavorite: boolean;
    folderId: string;
    order: number;
    createdAt: string;
    updatedAt: string;
}

export interface ConnectionFolder {
    id: string;
    name: string;
    color: string | null;
    parentId?: string | null;
    links: ConnectionLink[];
    order: number;
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
    reorderFolders: (newFolders: ConnectionFolder[]) => Promise<void>;
    reorderLinks: (folderId: string, newLinks: ConnectionLink[]) => Promise<void>;
    setupSocket: () => () => void;
    
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
            set((state) => {
                if (state.folders.find(f => f.id === response.data.id)) return state;
                return { folders: [...state.folders, { ...response.data, links: [] }] };
            });
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

    addLink: async (data) => {
        try {
            const response = await api.post('/connections/links', data);
            set((state) => ({
                folders: state.folders.map((f) => {
                    if (f.id === data.folderId) {
                        if (f.links.find(l => l.id === response.data.id)) return f;
                        return { ...f, links: [...f.links, response.data] };
                    }
                    return f;
                })
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
    },

    reorderFolders: async (newFolders) => {
        // Optimistic update
        const oldFolders = get().folders;
        const reordered = newFolders.map((f, i) => ({ ...f, order: i }));
        set({ folders: reordered });

        // Only send items whose order actually changed (optimization)
        const changedItems = reordered
            .filter((f, i) => f.order !== oldFolders.find(old => old.id === f.id)?.order)
            .map(f => ({ id: f.id, order: f.order }));

        if (changedItems.length === 0) return;

        try {
            await api.put('/connections/folders/reorder', {
                folders: changedItems
            });
        } catch (error: any) {
            console.error('Failed to reorder folders:', error);
            set({ folders: oldFolders }); // Rollback
        }
    },

    reorderLinks: async (folderId, newLinks) => {
        // Optimistic update
        const oldFolders = get().folders;
        const reorderedLinks = newLinks.map((l, i) => ({ ...l, order: i }));
        
        set((state) => ({
            folders: state.folders.map((f) => 
                f.id === folderId ? { ...f, links: reorderedLinks } : f
            )
        }));

        // Find which links actually changed order
        const folder = oldFolders.find(f => f.id === folderId);
        if (!folder) return;

        const changedItems = reorderedLinks
            .filter((l, i) => l.order !== folder.links.find(old => old.id === l.id)?.order)
            .map(l => ({ id: l.id, order: l.order }));

        if (changedItems.length === 0) return;

        try {
            await api.put('/connections/links/reorder', {
                links: changedItems
            });
        } catch (error: any) {
            console.error('Failed to reorder links:', error);
            set({ folders: oldFolders }); // Rollback
        }
    },

    setupSocket: () => {
        const handler = (data: any) => {
            if (data.store !== 'CONNECTION') return;

            const { type, payload } = data;
            const state = get();

            switch (type) {
                case 'ADD_FOLDER':
                    if (!state.folders.find(f => f.id === payload.id)) {
                        set(s => ({ folders: [...s.folders, { ...payload, links: [] }] }));
                    }
                    break;
                case 'UPDATE_FOLDER':
                    set(s => ({
                        folders: s.folders.map(f => f.id === payload.id ? { ...f, ...payload.data } : f)
                    }));
                    break;
                case 'TRASH_FOLDER':
                    set(s => ({
                        folders: s.folders.filter(f => f.id !== payload.id)
                    }));
                    break;
                case 'RESTORE_FOLDER':
                    state.fetchFolders(false);
                    break;
                case 'DELETE_FOLDER':
                    set(s => ({
                        trashedFolders: s.trashedFolders.filter(f => f.id !== payload.id)
                    }));
                    break;
                case 'REORDER_FOLDERS':
                    // We only reorder if the payload has the new array or just refresh
                    state.fetchFolders(false);
                    break;
                case 'ADD_LINK':
                    set(s => ({
                        folders: s.folders.map(f => 
                            f.id === payload.folderId 
                                ? { ...f, links: f.links.find(l => l.id === payload.id) ? f.links : [...f.links, payload] } 
                                : f
                        )
                    }));
                    break;
                case 'UPDATE_LINK':
                    set(s => ({
                        folders: s.folders.map(f => ({
                            ...f,
                            links: f.links.map(l => l.id === payload.id ? { ...l, ...payload.data } : l)
                        }))
                    }));
                    break;
                case 'TRASH_LINK':
                    set(s => ({
                        folders: s.folders.map(f => ({
                            ...f,
                            links: f.links.filter(l => l.id !== payload.id)
                        }))
                    }));
                    break;
                case 'RESTORE_LINK':
                    state.fetchFolders(false);
                    break;
                case 'REORDER_LINKS':
                    state.fetchFolders(false);
                    break;
            }
        };

        socketService.on('system_sync', handler);
        return () => socketService.off('system_sync', handler);
    }
}));
