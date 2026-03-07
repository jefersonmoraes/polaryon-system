import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    addCertificate: (cert: Omit<CapacityCertificate, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateCertificate: (id: string, cert: Partial<CapacityCertificate>) => void;
    trashCertificate: (id: string) => void;
    restoreCertificate: (id: string) => void;
    permanentlyDeleteCertificate: (id: string) => void;
    cleanOldTrash: () => void;
}

export const useCertificateStore = create<CertificateStore>()(
    persist(
        (set) => ({
            certificates: [],
            addCertificate: (cert) => {
                const id = crypto.randomUUID();
                const now = new Date().toISOString();
                set((state) => ({
                    certificates: [
                        ...state.certificates,
                        { ...cert, id, createdAt: now, updatedAt: now },
                    ],
                }));
            },
            updateCertificate: (id, updatedFields) => {
                set((state) => ({
                    certificates: state.certificates.map((cert) =>
                        cert.id === id ? { ...cert, ...updatedFields, updatedAt: new Date().toISOString() } : cert
                    ),
                }));
            },
            trashCertificate: (id) => {
                set((state) => ({
                    certificates: state.certificates.map((cert) =>
                        cert.id === id ? { ...cert, trashed: true, trashedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : cert
                    ),
                }));
            },
            restoreCertificate: (id) => {
                set((state) => ({
                    certificates: state.certificates.map((cert) =>
                        cert.id === id ? { ...cert, trashed: false, updatedAt: new Date().toISOString() } : cert
                    ),
                }));
            },
            permanentlyDeleteCertificate: (id) => {
                set((state) => ({
                    certificates: state.certificates.filter((cert) => cert.id !== id),
                }));
            },
            cleanOldTrash: () => set(state => {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                return {
                    certificates: state.certificates.filter(cert => !cert.trashedAt || new Date(cert.trashedAt) >= thirtyDaysAgo)
                };
            })
        }),
        {
            name: 'polaryon-certificates-storage',
            version: 1,
        }
    )
);
