import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { socketService } from '@/lib/socket';
import api from '@/lib/api';

export interface CertificateAttachment {
    id: string;
    fileSlot: 'Atestado' | 'NF' | 'Contrato' | 'Nota de Empenho' | 'Relatório de execução';
    fileName: string;
    fileSize: number;
    fileData: string; // Base64
}

export interface CapacityCertificate {
    id: string;
    type: ('Produto' | 'Serviço')[];
    suppliedItems: string;
    suppliedQuantity?: string;
    kunbunCardId?: string; // Reference to a card if applicable
    issuingAgency: string;
    executionDate: string;
    description: string;
    attachments: CertificateAttachment[];
    createdAt: string;
    updatedAt: string;
    trashed?: boolean;
    trashedAt?: string;
}

interface CertificateStore {
    certificates: CapacityCertificate[];
    setCertificates: (certs: CapacityCertificate[]) => void;
    addCertificate: (cert: Omit<CapacityCertificate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateCertificate: (id: string, cert: Partial<CapacityCertificate>) => Promise<void>;
    trashCertificate: (id: string) => Promise<void>;
    restoreCertificate: (id: string) => Promise<void>;
    permanentlyDeleteCertificate: (id: string) => Promise<void>;
    cleanOldTrash: () => void;
    syncLocalDataToServer: () => Promise<void>;
    processSystemAction: (action: any) => void;
}

export const useCertificateStore = create<CertificateStore>()(
    persist(
        (set, get) => ({
            certificates: [],

            setCertificates: (certificates) => set({ certificates }),

            addCertificate: async (cert) => {
                try {
                    const response = await api.post('/certificates', cert);
                    const newCert = response.data;
                    set((state) => ({
                        certificates: [...state.certificates, newCert],
                    }));
                    socketService.emit('system_action', { store: 'CERTIFICATES', type: 'ADD_CERT', payload: newCert });
                } catch (error) {
                    console.error('Failed to add certificate:', error);
                }
            },

            updateCertificate: async (id, updatedFields) => {
                try {
                    const response = await api.put(`/certificates/${id}`, updatedFields);
                    const updatedCert = response.data;
                    set((state) => ({
                        certificates: state.certificates.map((cert) =>
                            cert.id === id ? updatedCert : cert
                        ),
                    }));
                    socketService.emit('system_action', { store: 'CERTIFICATES', type: 'UPDATE_CERT', payload: { id, data: updatedFields } });
                } catch (error) {
                    console.error('Failed to update certificate:', error);
                }
            },

            trashCertificate: async (id) => {
                const now = new Date().toISOString();
                const updates = { trashed: true, trashedAt: now };
                try {
                    await api.put(`/certificates/${id}`, updates);
                    set((state) => ({
                        certificates: state.certificates.map((cert) =>
                            cert.id === id ? { ...cert, ...updates, updatedAt: now } : cert
                        ),
                    }));
                    socketService.emit('system_action', { store: 'CERTIFICATES', type: 'TRASH_CERT', payload: { id } });
                } catch (error) {
                    console.error('Failed to trash certificate:', error);
                }
            },

            restoreCertificate: async (id) => {
                const now = new Date().toISOString();
                const updates = { trashed: false };
                try {
                    await api.put(`/certificates/${id}`, updates);
                    set((state) => ({
                        certificates: state.certificates.map((cert) =>
                            cert.id === id ? { ...cert, ...updates, updatedAt: now } : cert
                        ),
                    }));
                    socketService.emit('system_action', { store: 'CERTIFICATES', type: 'RESTORE_CERT', payload: { id } });
                } catch (error) {
                    console.error('Failed to restore certificate:', error);
                }
            },

            permanentlyDeleteCertificate: async (id) => {
                try {
                    await api.delete(`/certificates/${id}`);
                    set((state) => ({
                        certificates: state.certificates.filter((cert) => cert.id !== id),
                    }));
                    socketService.emit('system_action', { store: 'CERTIFICATES', type: 'DELETE_CERT', payload: { id } });
                } catch (error) {
                    console.error('Failed to delete certificate:', error);
                }
            },

            cleanOldTrash: () => {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const toDelete = get().certificates.filter(c => c.trashedAt && new Date(c.trashedAt) < thirtyDaysAgo);
                toDelete.forEach(c => get().permanentlyDeleteCertificate(c.id));
            },

            syncLocalDataToServer: async () => {
                // This checks if we have certificates that only exist locally (e.g. they don't have a DB-like ID format if needed, 
                // but here we use UUIDs everywhere, so we check against the server if they exist or just push all non-synced)
                // For simplicity, we'll look for certs that might have been created offline or before persistence was added.
                // We'll rely on the server handling deduplication or just push what's missing.
                const localCerts = get().certificates;
                if (localCerts.length === 0) return;

                console.log("Syncing local certificates to server...");
                // In a real scenario, we'd fetch from server and compare.
                // But since we know the server is empty right now, we can push all.
                for (const cert of localCerts) {
                    try {
                        await api.post('/certificates', cert);
                    } catch (e) {
                        console.error("Sync failed for cert:", cert.id, e);
                    }
                }
            },

            processSystemAction: (action: any) => {
                const { type, payload } = action;
                if (type === 'ADD_CERT') {
                    set(s => {
                        if (s.certificates.some(c => c.id === payload.id)) return s;
                        return { certificates: [...s.certificates, payload] };
                    });
                } else if (type === 'UPDATE_CERT') {
                    set(s => ({
                        certificates: s.certificates.map(c => c.id === payload.id ? { ...c, ...payload.data, updatedAt: new Date().toISOString() } : c)
                    }));
                } else if (type === 'TRASH_CERT') {
                    set(s => ({
                        certificates: s.certificates.map(c => c.id === payload.id ? { ...c, trashed: true, trashedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : c)
                    }));
                } else if (type === 'RESTORE_CERT') {
                    set(s => ({
                        certificates: s.certificates.map(c => c.id === payload.id ? { ...c, trashed: false, updatedAt: new Date().toISOString() } : c)
                    }));
                } else if (type === 'DELETE_CERT') {
                    set(s => ({ certificates: s.certificates.filter(c => c.id !== payload.id) }));
                }
            }
        }),
        {
            name: 'polaryon-certificates-storage',
            version: 1,
        }
    )
);

// Subscribe to global system events
socketService.on('system_sync', (action: any) => {
    if (action.store === 'CERTIFICATES') {
        useCertificateStore.getState().processSystemAction(action);
    }
});

