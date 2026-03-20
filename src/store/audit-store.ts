import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '@/lib/api';

export type ActionType = 'CRIAR' | 'EDITAR' | 'EXCLUIR' | 'MOVER' | 'STATUS' | 'LOGIN' | 'SISTEMA';
export type EntityType = 'CARTÃO' | 'ORÇAMENTO' | 'LANÇAMENTO' | 'DOCUMENTO' | 'EMPRESA' | 'USUÁRIO' | 'QUADRO/LISTA';

export interface AuditLog {
    id: string;
    userId: string;
    userName: string;
    action: ActionType;
    entity: EntityType;
    details: string;
    timestamp: string;
}

interface AuditState {
    logs: AuditLog[];
    setLogs: (logs: AuditLog[]) => void;
    addLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => Promise<void>;
    fetchLogs: () => Promise<void>;
    clearOldLogs: (daysToKeep?: number) => void;
}

export const useAuditStore = create<AuditState>()(
    persist(
        (set, get) => ({
            logs: [],

            setLogs: (logs) => set({ logs }),

            addLog: async (log) => {
                try {
                    const response = await api.post('/audit', log);
                    const newLog = response.data;
                    set((state) => ({
                        logs: [newLog, ...state.logs].slice(0, 5000)
                    }));
                } catch (error) {
                    console.error('Failed to add audit log:', error);
                    // Fallback to local only if API fails
                    const localLog: AuditLog = {
                        ...log,
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString()
                    };
                    set((state) => ({
                        logs: [localLog, ...state.logs].slice(0, 5000)
                    }));
                }
            },

            fetchLogs: async () => {
                try {
                    const response = await api.get('/audit');
                    set({ logs: response.data || [] });
                } catch (error) {
                    console.error('Failed to fetch audit logs:', error);
                }
            },

            clearOldLogs: (daysToKeep = 90) => {
                const now = new Date();
                const cutoff = new Date(now.getTime() - (daysToKeep * 24 * 60 * 60 * 1000));

                set((state) => ({
                    logs: state.logs.filter(log => new Date(log.timestamp) >= cutoff)
                }));
            }
        }),
        {
            name: 'kanban-audit-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
