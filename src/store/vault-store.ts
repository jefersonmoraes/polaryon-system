import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

export interface BiddingCredential {
    id: string;
    companyId: string;
    alias: string;
    cnpj: string;
    isActive: boolean;
    createdAt: string;
}

interface VaultStore {
    credentials: BiddingCredential[];
    isLoading: boolean;
    error: string | null;
    fetchCredentials: (companyId: string) => Promise<void>;
    addCredential: (formData: FormData) => Promise<void>;
    deleteCredential: (id: string) => Promise<void>;
}

export const useVaultStore = create<VaultStore>()(
    persist(
        (set, get) => ({
            credentials: [],
            isLoading: false,
            error: null,

            fetchCredentials: async (companyId) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.get(`/bidding/credentials?companyId=${companyId}`);
                    if (response.data && response.data.success) {
                        set({ credentials: response.data.credentials, isLoading: false });
                    }
                } catch (error: any) {
                    set({ error: error.message, isLoading: false });
                }
            },

            addCredential: async (formData) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post('/bidding/credentials', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    if (response.data && response.data.success) {
                        // Refresh credentials list after adding
                        const companyId = formData.get('companyId') as string;
                        if (companyId) await get().fetchCredentials(companyId);
                    }
                } catch (error: any) {
                    set({ error: error.message, isLoading: false });
                    throw error;
                }
            },

            deleteCredential: async (id) => {
                // Endpoint delete not yet in routes, but we can implement it or just filter locally if needed
                // For now, let's assume it exists or we add it later.
                try {
                    // await api.delete(`/bidding/credentials/${id}`);
                    set(state => ({
                        credentials: state.credentials.filter(c => c.id !== id)
                    }));
                } catch (error: any) {
                    set({ error: error.message });
                }
            }
        }),
        {
            name: 'polaryon-vault-storage',
            version: 1,
        }
    )
);
