import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { socketService } from '@/lib/socket';
import { useAuditStore } from './audit-store';
import { useAuthStore } from './auth-store';
import { fixDateToBRT } from '@/lib/utils';
import api from '@/lib/api';

export type DocumentStatus = 'valid' | 'expiring' | 'expired';

export interface DocumentAttachment {
    id: string;
    fileName: string;
    fileSize: number;
    fileData: string; // Base64 data URL
}

export interface CompanyDocument {
    id: string;
    title: string;
    type: string;
    issueDate?: string;
    expirationDate: string;
    link?: string;
    description?: string;
    observations?: string;
    whereToIssue?: string;
    attachments?: DocumentAttachment[];
    fileData?: string;
    fileName?: string;
    fileSize?: number;
    companyId?: string;
    createdAt: string;
    updatedAt: string;
    status: DocumentStatus;
    lastNotifiedIndex?: number;
    trashed?: boolean;
    trashedAt?: string;
}

interface DocumentStore {
    documents: CompanyDocument[];
    setDocuments: (docs: CompanyDocument[]) => void;
    addDocument: (doc: Omit<CompanyDocument, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<void>;
    updateDocument: (id: string, doc: Partial<CompanyDocument>) => Promise<void>;
    trashDocument: (id: string) => Promise<void>;
    restoreDocument: (id: string) => Promise<void>;
    permanentlyDeleteDocument: (id: string) => Promise<void>;
    validateDocumentStatuses: () => void;
    cleanOldTrash: () => void;
    syncLocalDataToServer: () => Promise<void>;
    processSystemAction: (action: any) => void;
}

const checkStatus = (expirationDate: string): DocumentStatus => {
    const expDate = fixDateToBRT(expirationDate);
    if (!expDate) return 'valid'; // Or whatever default makes sense for missing dates
    
    // Normalize to midnight for comparison
    const target = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = target.getTime() - today.getTime();
    // Use floor for days remaining to be conservative
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    // User wants alert ONLY when 10 days or less are remaining
    if (diffDays <= 10) return 'expiring';
    return 'valid';
};

export const useDocumentStore = create<DocumentStore>()(
    persist(
        (set, get) => ({
            documents: [],

            setDocuments: (documents) => {
                // Always re-calculate status when loading from server/cache 
                // to respect the latest business rules (e.g. 10-day threshold)
                const validatedDocs = documents.map(doc => ({
                    ...doc,
                    status: checkStatus(doc.expirationDate)
                }));
                set({ documents: validatedDocs });
            },

            addDocument: async (doc) => {
                const status = checkStatus(doc.expirationDate);
                const currentUser = useAuthStore.getState().currentUser;

                try {
                    const response = await api.post('/documents/company', {
                        ...doc,
                        status
                    });

                    const newDoc = response.data;

                    if (currentUser) {
                        useAuditStore.getState().addLog({
                            userId: currentUser.id,
                            userName: currentUser.name,
                            action: 'CRIAR',
                            entity: 'DOCUMENTO',
                            details: `Fez upload do documento "${doc.title}"`
                        });
                    }

                    set((state) => ({
                        documents: [...state.documents, newDoc],
                    }));
                    
                    api.post('/kanban/socketproxy', { store: 'DOCUMENTS', type: 'ADD_DOC', payload: newDoc });
                } catch (error) {
                    console.error('Failed to add document:', error);
                }
            },

            updateDocument: async (id, updatedFields) => {
                const currentUser = useAuthStore.getState().currentUser;
                const oldDoc = get().documents.find(d => d.id === id);

                if (currentUser && oldDoc && !updatedFields.lastNotifiedIndex) {
                    useAuditStore.getState().addLog({
                        userId: currentUser.id,
                        userName: currentUser.name,
                        action: 'EDITAR',
                        entity: 'DOCUMENTO',
                        details: `Atualizou dados do documento "${oldDoc.title}"`
                    });
                }

                try {
                    const response = await api.put(`/documents/company/${id}`, updatedFields);
                    const updatedDoc = response.data;

                    set((state) => ({
                        documents: state.documents.map((doc) => doc.id === id ? updatedDoc : doc),
                    }));

                    api.post('/kanban/socketproxy', { store: 'DOCUMENTS', type: 'UPDATE_DOC', payload: { id, data: updatedFields } });
                } catch (error) {
                    console.error('Failed to update document:', error);
                }
            },

            trashDocument: async (id) => {
                const currentUser = useAuthStore.getState().currentUser;
                const targetDoc = get().documents.find(d => d.id === id);

                if (currentUser && targetDoc) {
                    useAuditStore.getState().addLog({
                        userId: currentUser.id,
                        userName: currentUser.name,
                        action: 'EXCLUIR',
                        entity: 'DOCUMENTO',
                        details: `Moveu o documento "${targetDoc.title}" para a lixeira`
                    });
                }

                const now = new Date().toISOString();
                const updates = { trashed: true, trashedAt: now };

                try {
                    await api.put(`/documents/company/${id}`, updates);
                    set((state) => ({
                        documents: state.documents.map((doc) =>
                            doc.id === id ? { ...doc, ...updates, updatedAt: now } : doc
                        ),
                    }));
                    socketService.emit('system_action', { store: 'DOCUMENTS', type: 'TRASH_DOC', payload: { id } });
                } catch (error) {
                    console.error('Failed to trash document:', error);
                }
            },

            restoreDocument: async (id) => {
                const now = new Date().toISOString();
                const updates = { trashed: false };

                try {
                    await api.put(`/documents/company/${id}`, updates);
                    set((state) => ({
                        documents: state.documents.map((doc) =>
                            doc.id === id ? { ...doc, ...updates, updatedAt: now } : doc
                        ),
                    }));
                    socketService.emit('system_action', { store: 'DOCUMENTS', type: 'RESTORE_DOC', payload: { id } });
                } catch (error) {
                    console.error('Failed to restore document:', error);
                }
            },

            permanentlyDeleteDocument: async (id) => {
                try {
                    await api.delete(`/documents/company/${id}`);
                    set((state) => ({
                        documents: state.documents.filter((doc) => doc.id !== id),
                    }));
                    socketService.emit('system_action', { store: 'DOCUMENTS', type: 'DELETE_DOC', payload: { id } });
                } catch (error) {
                    console.error('Failed to delete document:', error);
                }
            },

            validateDocumentStatuses: () => {
                set((state) => ({
                    documents: state.documents.map((doc) => ({
                        ...doc,
                        status: checkStatus(doc.expirationDate),
                    })),
                }));
            },

            cleanOldTrash: () => {
                const state = get();
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const toDelete = state.documents.filter(doc => doc.trashedAt && new Date(doc.trashedAt) < thirtyDaysAgo);
                
                toDelete.forEach(doc => get().permanentlyDeleteDocument(doc.id));
            },

            syncLocalDataToServer: async () => {
                const localDocs = get().documents;
                if (localDocs.length === 0) return;

                try {
                    // Busca os docs existentes no servidor para não duplicar
                    const serverRes = await api.get('/documents/company');
                    const serverIds = new Set((serverRes.data || []).map((d: any) => d.id));
                    const docsToSync = localDocs.filter(d => !serverIds.has(d.id) && !d.trashed);
                    
                    if (docsToSync.length === 0) {
                        console.log("Documentos já sincronizados com o servidor.");
                        return;
                    }
                    
                    console.log(`Sincronizando ${docsToSync.length} documento(s) local(is) com o servidor...`);
                    for (const doc of docsToSync) {
                        try {
                            await api.post('/documents/company', doc);
                        } catch (e) {
                            console.error("Falha ao sincronizar doc:", doc.id, e);
                        }
                    }
                    // Após sincronizar, recarrega do servidor para garantir consistência
                    const updatedRes = await api.get('/documents/company');
                    if (updatedRes.data) set({ documents: updatedRes.data });
                } catch (e) {
                    console.error("Falha na sincronização local->servidor:", e);
                }
            },

            processSystemAction: (action: any) => {
                const { type, payload } = action;
                if (type === 'ADD_DOC') {
                    set(s => {
                        if (s.documents.some(d => d.id === payload.id)) return s;
                        return { documents: [...s.documents, payload] };
                    });
                } else if (type === 'UPDATE_DOC') {
                    set(s => ({
                        documents: s.documents.map(d => {
                            if (d.id === payload.id) {
                                const merged: any = { ...d, ...payload.data, updatedAt: new Date().toISOString() };
                                if (payload.data.expirationDate) {
                                    merged.status = checkStatus(merged.expirationDate);
                                }
                                return merged;
                            }
                            return d;
                        })
                    }));
                } else if (type === 'TRASH_DOC') {
                    set(s => ({
                        documents: s.documents.map(d => d.id === payload.id ? { ...d, trashed: true, trashedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : d)
                    }));
                } else if (type === 'RESTORE_DOC') {
                    set(s => ({
                        documents: s.documents.map(d => d.id === payload.id ? { ...d, trashed: false, updatedAt: new Date().toISOString() } : d)
                    }));
                } else if (type === 'DELETE_DOC') {
                    set(s => ({ documents: s.documents.filter(d => d.id !== payload.id) }));
                }
            }
        }),
        {
            name: 'polaryon-document-storage',
            version: 1,
        }
    )
);

// Subscribe to global system events
socketService.on('system_sync', (action: any) => {
    if (action.store === 'DOCUMENTS') {
        useDocumentStore.getState().processSystemAction(action);
    }
});
