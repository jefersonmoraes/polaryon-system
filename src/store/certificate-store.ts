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
    kanbanCardId?: string; // Reference to a card if applicable
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
    fetchCertificates: () => Promise<void>;
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

            fetchCertificates: async () => {
                try {
                    const response = await api.get('/certificates');
                    if (response.data) {
                        get().setCertificates(response.data);
                    }
                } catch (error) {
                    console.error('Failed to fetch certificates:', error);
                }
            },

            syncLocalDataToServer: async () => {
                const localCerts = get().certificates;
                if (localCerts.length === 0) return;

                console.log("Checking and syncing local certificates to server...");
                try {
                    // Fetch existing to avoid duplicates
                    const serverRes = await api.get('/certificates');
                    const serverIds = new Set((serverRes.data || []).map((c: any) => c.id));
                    const certsToSync = localCerts.filter(c => !serverIds.has(c.id) && !c.trashed);

                    if (certsToSync.length > 0) {
                        for (const cert of certsToSync) {
                            try {
                                await api.post('/certificates', cert);
                            } catch (e) {
                                console.error("Sync failed for cert:", cert.id, e);
                            }
                        }
                    }

                    // Reload from server to ensure local state has DB state
                    const updatedRes = await api.get('/certificates');
                    if (updatedRes.data) {
                        set({ certificates: updatedRes.data });
                    }
                } catch (e) {
                    console.error("Failed to sync certificates:", e);
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

