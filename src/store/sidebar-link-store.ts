import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

export interface SidebarLink {
    id: string;
    title: string;
    url: string;
    category: string;
    isFavorite: boolean;
    createdAt: string;
    updatedAt: string;
}

interface SidebarLinkStore {
    links: SidebarLink[];
    fetchLinks: (category?: string) => Promise<void>;
    addLink: (link: Omit<SidebarLink, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    deleteLink: (id: string) => Promise<void>;
}

export const useSidebarLinkStore = create<SidebarLinkStore>()(
    persist(
        (set, get) => ({
            links: [],

            fetchLinks: async (category) => {
                try {
                    const response = await api.get('/sidebar-links', {
                        params: { category }
                    });
                    set({ links: response.data });
                } catch (error) {
                    console.error('Failed to fetch sidebar links:', error);
                }
            },

            addLink: async (linkData) => {
                try {
                    const response = await api.post('/sidebar-links', linkData);
                    const newLink = response.data;
                    set((state) => ({
                        links: [...state.links, newLink]
                    }));
                } catch (error) {
                    console.error('Failed to add sidebar link:', error);
                }
            },

            deleteLink: async (id) => {
                try {
                    await api.delete(`/sidebar-links/${id}`);
                    set((state) => ({
                        links: state.links.filter((l) => l.id !== id)
                    }));
                } catch (error) {
                    console.error('Failed to delete sidebar link:', error);
                }
            }
        }),
        {
            name: 'polaryon-sidebar-links-storage',
        }
    )
);
