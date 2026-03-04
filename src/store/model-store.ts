import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ModelAttachment {
    id: string;
    fileName: string;
    fileSize: number;
    fileData: string; // Base64
}

export interface EssentialModel {
    id: string;
    title: string;
    description: string;
    isPredefined: boolean;
    attachments: ModelAttachment[];
    trashed?: boolean;
    createdAt: string;
}

interface ModelStore {
    models: EssentialModel[];
    addModel: (model: Omit<EssentialModel, 'id' | 'isPredefined' | 'createdAt'>) => void;
    updateModel: (id: string, updates: Partial<EssentialModel>) => void;
    trashModel: (id: string) => void;
    restoreModel: (id: string) => void;
    permanentlyDeleteModel: (id: string) => void;
}

const PREDEFINED_MODELS: EssentialModel[] = [
    {
        id: 'pre-1', title: 'Pedido de Impugnação de Edital',
        description: 'Modelo padrão para impugnar cláusulas restritivas ou ilegais em editais de licitação, fundamentado na Lei 14.133/2021.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-2', title: 'Pedido de Esclarecimentos',
        description: 'Utilizado para sanar dúvidas sobre o instrumento convocatório e seus anexos.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-3', title: 'Pedido de Reequilíbrio Econômico-Financeiro',
        description: 'Voltado a readequar os valores pactuados devido a fatos imprevisíveis ou previsíveis de consequências incalculáveis (álea econômica extraordinária).',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-4', title: 'Recurso Administrativo',
        description: 'Peça essencial para contestar a habilitação ou inabilitação, bem como o próprio julgamento das propostas na sessão pública.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-5', title: 'Contrarrazões de Recurso',
        description: 'Documento utilizado para defender e contra-atacar um Recurso Administrativo interposto por empresa concorrente.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-6', title: 'Declaração de Inexistência de Fatos Impeditivos',
        description: 'Garante, sob as penas da lei, que não existem fatos supervenientes que impeçam a habilitação da empresa.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-7', title: 'Declaração de Cumprimento dos Requisitos de Habilitação',
        description: 'Afirmação obrigatória na fase inicial das licitações comprovando que a empresa atende a todas exingências habilitatórias.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-8', title: 'Termo de Renúncia ao Recurso',
        description: 'Formaliza a intenção das empresas de não esgotar as vias recursais durante a finalização do certame.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-9', title: 'Pedido de Prorrogação de Prazo',
        description: 'Solicita estender prazos limitados (seja de entrega, assinatura, etc).',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-10', title: 'Notificação de Descumprimento Contratual',
        description: 'Comunicado oficial à Administração, ou aos fornecedores, sobre quebras de contrato.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-11', title: 'Solicitação de Substituição de Garantia Contratual',
        description: 'Usado para trocar modalidades de garantia (ex: Seguro Garantia por Título da Dívida).',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-12', title: 'Pedido de Rescisão Contratual',
        description: 'Invocado por falta de pagamentos pela Administração por mais de 90 dias, entre outros motivos listados na lei.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-13', title: 'Solicitação de Pagamento em Atraso',
        description: 'Pleito padrão para acionar órgãos públicos sobre quebra das sequências de empenho e pagamentos das notas.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-14', title: 'Termo de Ciência e Concordância',
        description: 'Aceite de condições complementares à Licitação.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-15', title: 'Pedido de Revisão de Penalidade',
        description: 'Impugna multas, declarações de inidoneidade ou suspensos apontados ao decorrer do contrato.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    },
    {
        id: 'pre-16', title: 'Pedido de Anulação ou Revogação de Licitação',
        description: 'Busca o esfacelamento do edital a depender de razões de interesse público ou vícios de ilegalidade.',
        isPredefined: true, attachments: [], createdAt: new Date().toISOString()
    }
];

export const useModelStore = create<ModelStore>()(
    persist(
        (set) => ({
            models: PREDEFINED_MODELS,

            addModel: (model) => set((state) => ({
                models: [
                    ...state.models,
                    {
                        ...model,
                        id: crypto.randomUUID(),
                        createdAt: new Date().toISOString(),
                        isPredefined: false
                    }
                ]
            })),

            updateModel: (id, updates) => set((state) => ({
                models: state.models.map(model =>
                    model.id === id ? { ...model, ...updates } : model
                )
            })),

            trashModel: (id) => set((state) => ({
                models: state.models.map(model =>
                    model.id === id ? { ...model, trashed: true } : model
                )
            })),

            restoreModel: (id) => set((state) => ({
                models: state.models.map(model =>
                    model.id === id ? { ...model, trashed: false } : model
                )
            })),

            permanentlyDeleteModel: (id) => set((state) => ({
                models: state.models.filter(model => model.id !== id)
            })),
        }),
        {
            name: 'polaryon-model-storage',
            // To ensure new predefined models get properly merged if we add more to the code later without destroying user data:
            merge: (persistedState: any, currentState) => {
                const mergedModels = [...currentState.models];
                if (persistedState && persistedState.models) {
                    const savedModels = persistedState.models;
                    // Keep the user-created ones and already modified predefined ones
                    savedModels.forEach((savedModel: EssentialModel) => {
                        const idx = mergedModels.findIndex(m => m.id === savedModel.id);
                        if (idx !== -1) {
                            mergedModels[idx] = savedModel;
                        } else if (!savedModel.isPredefined) {
                            mergedModels.push(savedModel);
                        }
                    });
                }
                return { ...currentState, ...persistedState, models: mergedModels };
            }
        }
    )
);
