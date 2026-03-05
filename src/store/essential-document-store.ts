import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    createdAt: string;
    updatedAt: string;
    trashed?: boolean;
}

interface EssentialDocumentStore {
    models: EssentialDocumentModel[];
    addModel: (model: Omit<EssentialDocumentModel, 'id' | 'createdAt' | 'updatedAt' | 'trashed'>) => void;
    updateModel: (id: string, model: Partial<EssentialDocumentModel>) => void;
    trashModel: (id: string) => void;
    restoreModel: (id: string) => void;
    permanentlyDeleteModel: (id: string) => void;
    initializeDefaultModels: () => void;
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

            addModel: (model) => {
                const id = crypto.randomUUID();
                const now = new Date().toISOString();

                set((state) => ({
                    models: [
                        ...state.models,
                        { ...model, id, createdAt: now, updatedAt: now },
                    ],
                }));
            },

            updateModel: (id, updatedFields) => {
                set((state) => ({
                    models: state.models.map((model) => {
                        if (model.id === id) {
                            return { ...model, ...updatedFields, updatedAt: new Date().toISOString() };
                        }
                        return model;
                    }),
                }));
            },

            trashModel: (id) => {
                set((state) => ({
                    models: state.models.map((model) =>
                        model.id === id ? { ...model, trashed: true, updatedAt: new Date().toISOString() } : model
                    ),
                }));
            },

            restoreModel: (id) => {
                set((state) => ({
                    models: state.models.map((model) =>
                        model.id === id ? { ...model, trashed: false, updatedAt: new Date().toISOString() } : model
                    ),
                }));
            },

            permanentlyDeleteModel: (id) => {
                set((state) => ({
                    models: state.models.filter((model) => model.id !== id),
                }));
            },

            initializeDefaultModels: () => {
                const state = get();
                if (state.models.length === 0) {
                    const now = new Date().toISOString();
                    const defaultModelsData: EssentialDocumentModel[] = DEFAULT_MODELS.map(title => ({
                        id: crypto.randomUUID(),
                        title,
                        createdAt: now,
                        updatedAt: now,
                    }));

                    set({ models: defaultModelsData });
                }
            }
        }),
        {
            name: 'polaryon-essential-document-storage',
            version: 1,
        }
    )
);
