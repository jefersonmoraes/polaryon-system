import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import idbStorage from '@/lib/idb-storage';
import { socketService } from '@/lib/socket';
import api from '@/lib/api';

export interface EssentialDocumentAttachment {
    id: string;
    fileName: string;
    fileSize: number;
    fileData: string; // Base64
}

export interface EssentialDocumentModel {
    id: string;
    title: string;
    description?: string;
    attachments?: EssentialDocumentAttachment[];
    updatedAt: string;
    trashed?: boolean;
    trashedAt?: string;
}

interface EssentialDocumentStore {
    models: EssentialDocumentModel[];
    setModels: (models: EssentialDocumentModel[]) => void;
    addModel: (model: Omit<EssentialDocumentModel, 'id' | 'createdAt' | 'updatedAt' | 'trashed'>) => Promise<void>;
    updateModel: (id: string, model: Partial<EssentialDocumentModel>) => Promise<void>;
    trashModel: (id: string) => Promise<void>;
    restoreModel: (id: string) => Promise<void>;
    permanentlyDeleteModel: (id: string) => Promise<void>;
    initializeDefaultModels: () => void;
    cleanOldTrash: () => void;
    fetchModels: () => Promise<void>;
    processSystemAction: (action: any) => void;
}

const DEFAULT_MODELS = [
    "Pedido de Impugnação de Edital",
    "Pedido de Esclarecimentos",
    "Pedido de Reequilíbrio Econômico-Financeiro",
    "Recurso Administrativo",
    "Contrarrazões de Recurso",
    "Declaração de Inexistência de Fatos Impeditivos",
    "Declaração de Cumprimento dos Requisitos de Habilitação",
    "Termo de Renúncia ao Recurso",
    "Pedido de Prorrogação de Prazo",
    "Pedido de Dilação de Prazo",
    "Notificação de Descumprimento Contratual",
    "Solicitação de Substituição de Garantia Contratual",
    "Pedido de Rescisão Contratual",
    "Solicitação de Pagamento em Atraso",
    "Termo de Ciência e Concordância",
    "Termo de Referência ou Proposta Técnica",
    "Pedido de Revisão de Penalidade",
    "Relatórios de Execução Contratual",
    "Solicitação de Alteração Contratual",
    "Pedido de Anulação ou Revogação de Licitação"
];

export const useEssentialDocumentStore = create<EssentialDocumentStore>()(
    persist(
        (set, get) => ({
            models: [],

            setModels: (models) => {
                console.log('essentialDocumentStore - Setting Models:', models);
                set({ models });
            },

            addModel: async (model) => {
                try {
                    const response = await api.post('/documents/essential', model);
                    const newModel = response.data;

                    set((state) => ({
                        models: [...state.models, newModel],
                    }));
                    socketService.emit('system_action', { store: 'ESSENTIAL_DOCS', type: 'ADD_MODEL', payload: newModel });
                } catch (error) {
                    console.error('Failed to add essential document model:', error);
                }
            },

            updateModel: async (id, updatedFields) => {
                try {
                    const response = await api.put(`/documents/essential/${id}`, updatedFields);
                    const updatedModel = response.data;

                    set((state) => ({
                        models: state.models.map((model) => model.id === id ? updatedModel : model),
                    }));
                    socketService.emit('system_action', { store: 'ESSENTIAL_DOCS', type: 'UPDATE_MODEL', payload: { id, updatedFields } });
                } catch (error) {
                    console.error('Failed to update essential document model:', error);
                }
            },

            trashModel: async (id) => {
                const now = new Date().toISOString();
                const updates = { trashed: true, trashedAt: now };
                try {
                    await api.put(`/documents/essential/${id}`, updates);
                    set((state) => ({
                        models: state.models.map((model) =>
                            model.id === id ? { ...model, ...updates, updatedAt: now } : model
                        ),
                    }));
                    socketService.emit('system_action', { store: 'ESSENTIAL_DOCS', type: 'TRASH_MODEL', payload: { id } });
                } catch (error) {
                    console.error('Failed to trash essential document model:', error);
                }
            },

            restoreModel: async (id) => {
                const updates = { trashed: false };
                try {
                    await api.put(`/documents/essential/${id}`, updates);
                    set((state) => ({
                        models: state.models.map((model) =>
                            model.id === id ? { ...model, ...updates, updatedAt: new Date().toISOString() } : model
                        ),
                    }));
                    socketService.emit('system_action', { store: 'ESSENTIAL_DOCS', type: 'RESTORE_MODEL', payload: { id } });
                } catch (error) {
                    console.error('Failed to restore essential document model:', error);
                }
            },

            permanentlyDeleteModel: async (id) => {
                try {
                    await api.delete(`/documents/essential/${id}`);
                    set((state) => ({
                        models: state.models.filter((model) => model.id !== id),
                    }));
                    socketService.emit('system_action', { store: 'ESSENTIAL_DOCS', type: 'DELETE_MODEL', payload: { id } });
                } catch (error) {
                    console.error('Failed to delete essential document model:', error);
                }
            },

            initializeDefaultModels: () => {
                const state = get();
                if (state.models.length === 0) {
                    DEFAULT_MODELS.forEach(title => {
                        get().addModel({ title });
                    });
                }
            },

            cleanOldTrash: () => {
                const state = get();
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const toDelete = state.models.filter(m => m.trashedAt && new Date(m.trashedAt) < thirtyDaysAgo);
                toDelete.forEach(m => get().permanentlyDeleteModel(m.id));
            },

            fetchModels: async () => {
                try {
                    const response = await api.get('/documents/essential');
                    if (response.data) {
                        get().setModels(response.data);
                    }
                } catch (error) {
                    console.error('Failed to fetch essential document models:', error);
                }
            },

            processSystemAction: (action: any) => {
                const { type, payload } = action;
                if (type === 'ADD_MODEL') {
                    set(s => {
                        if (s.models.some(m => m.id === payload.id)) return s;
                        return { models: [...s.models, payload] };
                    });
                } else if (type === 'UPDATE_MODEL') {
                    set(s => ({ models: s.models.map(m => m.id === payload.id ? { ...m, ...payload.updatedFields, updatedAt: new Date().toISOString() } : m) }));
                } else if (type === 'TRASH_MODEL') {
                    set(s => ({ models: s.models.map(m => m.id === payload.id ? { ...m, trashed: true, trashedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : m) }));
                } else if (type === 'RESTORE_MODEL') {
                    set(s => ({ models: s.models.map(m => m.id === payload.id ? { ...m, trashed: false, updatedAt: new Date().toISOString() } : m) }));
                } else if (type === 'DELETE_MODEL') {
                    set(s => ({ models: s.models.filter(m => m.id !== payload.id) }));
                }
            }
        }),
        {
            name: 'polaryon-essential-document-storage-idb',
            storage: createJSONStorage(() => idbStorage),
            version: 1,
            onRehydrateStorage: () => {
                // Cleanup old localStorage key
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.removeItem('polaryon-essential-document-storage');
                    } catch (e) {}
                }
            }
        }
    )
);

// Subscribe to global system events
socketService.on('system_sync', (action: any) => {
    if (action.store === 'ESSENTIAL_DOCS') {
        useEssentialDocumentStore.getState().processSystemAction(action);
    }
});
