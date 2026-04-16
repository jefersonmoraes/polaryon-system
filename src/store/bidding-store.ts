import { create } from 'zustand';

interface BiddingItem {
    itemId: string;
    valorAtual: number;
    meuValor: number;
    ganhador: string;
    status: string;
    tempoRestante: number;
    position: number;
    descricao?: string;
}

interface BiddingSession {
    sessionId: string;
    uasg: string;
    numero: string;
    ano: string;
    status: 'idle' | 'running' | 'error' | 'syncing';
    items: BiddingItem[];
    logs: any[];
    lastUpdate?: string;
}

interface BiddingStore {
    sessions: Record<string, BiddingSession>;
    activeSessionId: string | null;
    globalStats: {
        winning: number;
        totalValue: number;
    };
    
    // Actions
    addSession: (session: Partial<BiddingSession>) => void;
    updateSessionItems: (sessionId: string, items: BiddingItem[]) => void;
    updateSessionStatus: (sessionId: string, status: BiddingSession['status']) => void;
    addSessionLog: (sessionId: string, log: any) => void;
    setActiveSession: (sessionId: string | null) => void;
    removeSession: (sessionId: string) => void;
    calculateGlobalStats: () => void;
}

export const useBiddingStore = create<BiddingStore>((set, get) => ({
    sessions: {},
    activeSessionId: null,
    globalStats: { winning: 0, totalValue: 0 },

    addSession: (session) => set((state) => ({
        sessions: {
            ...state.sessions,
            [session.sessionId!]: {
                sessionId: '',
                uasg: '',
                numero: '',
                ano: '',
                status: 'idle',
                items: [],
                logs: [],
                ...session
            } as BiddingSession
        },
        // Se for a primeira sessão, torna ela ativa automaticamente
        activeSessionId: state.activeSessionId || session.sessionId!
    })),

    updateSessionItems: (sessionId, items) => {
        set((state) => {
            const session = state.sessions[sessionId];
            if (!session) return state;

            const newSessions = {
                ...state.sessions,
                [sessionId]: {
                    ...session,
                    items,
                    lastUpdate: new Date().toISOString(),
                    status: 'running'
                }
            };

            return { sessions: newSessions };
        });
        get().calculateGlobalStats();
    },

    updateSessionStatus: (sessionId, status) => set((state) => ({
        sessions: {
            ...state.sessions,
            [sessionId]: { ...state.sessions[sessionId], status }
        }
    })),

    addSessionLog: (sessionId, log) => set((state) => {
        const session = state.sessions[sessionId];
        if (!session) return state;
        return {
            sessions: {
                ...state.sessions,
                [sessionId]: {
                    ...session,
                    logs: [...session.logs.slice(-49), log]
                }
            }
        };
    }),

    setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

    removeSession: (sessionId) => set((state) => {
        const newSessions = { ...state.sessions };
        delete newSessions[sessionId];
        return {
            sessions: newSessions,
            activeSessionId: state.activeSessionId === sessionId ? (Object.keys(newSessions)[0] || null) : state.activeSessionId
        };
    }),

    calculateGlobalStats: () => {
        const { sessions } = get();
        let winning = 0;
        let totalValue = 0;

        Object.values(sessions).forEach(s => {
            s.items.forEach(it => {
                if (it.ganhador === 'Você') {
                    winning++;
                    totalValue += it.valorAtual;
                }
            });
        });

        set({ globalStats: { winning, totalValue } });
    }
}));
