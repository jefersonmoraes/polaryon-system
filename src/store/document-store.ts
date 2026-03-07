import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuditStore } from './audit-store';
import { useAuthStore } from './auth-store';

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

    // New fields
    link?: string;
    description?: string;
    observations?: string;
    whereToIssue?: string;

    // Attachments
    attachments?: DocumentAttachment[];

    // Deprecated single file fields (keeping for backward compatibility or migration)
    fileData?: string;
    fileName?: string;
    fileSize?: number;
    companyId?: string; // Optional: If we want to link it to a specific supplier/transporter
    createdAt: string;
    updatedAt: string;
    status: DocumentStatus;
    lastNotifiedIndex?: number; // internal: helps to not spam the same notification
    trashed?: boolean;
    trashedAt?: string;
}

interface DocumentStore {
    documents: CompanyDocument[];
    addDocument: (doc: Omit<CompanyDocument, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
    updateDocument: (id: string, doc: Partial<CompanyDocument>) => void;
    trashDocument: (id: string) => void;
    restoreDocument: (id: string) => void;
    permanentlyDeleteDocument: (id: string) => void;
    validateDocumentStatuses: () => void;
    cleanOldTrash: () => void;
}

const checkStatus = (expirationDate: string): DocumentStatus => {
    const expDate = new Date(expirationDate);
    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring';
    return 'valid';
};

export const useDocumentStore = create<DocumentStore>()(
    persist(
        (set, get) => ({
            documents: [],
            addDocument: (doc) => {
                const id = crypto.randomUUID();
                const now = new Date().toISOString();
                const status = checkStatus(doc.expirationDate);

                const currentUser = useAuthStore.getState().currentUser;
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
                    documents: [
                        ...state.documents,
                        { ...doc, id, createdAt: now, updatedAt: now, status },
                    ],
                }));
            },
            updateDocument: (id, updatedFields) => {
                const currentUser = useAuthStore.getState().currentUser;
                const oldDoc = get().documents.find(d => d.id === id);

                if (currentUser && oldDoc && !updatedFields.lastNotifiedIndex) {
                    // Avoid logging internal notification updates
                    useAuditStore.getState().addLog({
                        userId: currentUser.id,
                        userName: currentUser.name,
                        action: 'EDITAR',
                        entity: 'DOCUMENTO',
                        details: `Atualizou dados do documento "${oldDoc.title}"`
                    });
                }

                set((state) => ({
                    documents: state.documents.map((doc) => {
                        if (doc.id === id) {
                            const merged: any = { ...doc, ...updatedFields, updatedAt: new Date().toISOString() };
                            // Re-check status if expiration date changed
                            if (updatedFields.expirationDate) {
                                merged.status = checkStatus(merged.expirationDate);
                            }
                            return merged as CompanyDocument;
                        }
                        return doc;
                    }),
                }));
            },
            trashDocument: (id) => {
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

                set((state) => ({
                    documents: state.documents.map((doc) => doc.id === id ? { ...doc, trashed: true, trashedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : doc),
                }));
            },
            restoreDocument: (id) => {
                set((state) => ({
                    documents: state.documents.map((doc) => doc.id === id ? { ...doc, trashed: false, updatedAt: new Date().toISOString() } : doc),
                }));
            },
            permanentlyDeleteDocument: (id) => {
                set((state) => ({
                    documents: state.documents.filter((doc) => doc.id !== id),
                }));
            },
            validateDocumentStatuses: () => {
                set((state) => {
                    let changed = false;
                    const newDocs = state.documents.map(doc => {
                        if (doc.trashed) return doc; // Don't validate trashed docs
                        const newStatus = checkStatus(doc.expirationDate);
                        if (newStatus !== doc.status) {
                            changed = true;
                            return { ...doc, status: newStatus } as CompanyDocument;
                        }
                        return doc;
                    });
                    return changed ? { documents: newDocs } : state;
                });
            },
            cleanOldTrash: () => set(state => {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                return {
                    documents: state.documents.filter(doc => !doc.trashedAt || new Date(doc.trashedAt) >= thirtyDaysAgo)
                };
            })
        }),
        {
            name: 'polaryon-document-storage',
            version: 1,
        }
    )
);
