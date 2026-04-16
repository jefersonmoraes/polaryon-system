import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, Activity, RefreshCw, Play, Square, Settings2, Target, Zap, Shield, Key, History, AlertTriangle, CheckCircle2, Plus as PlusIcon, Check, Trophy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { socketService } from '@/lib/socket';
import { useAuthStore } from '../store/auth-store';
import api from '@/lib/api';
import { useVaultStore } from '@/store/vault-store';
import { useKanbanStore } from '@/store/kanban-store';
import { Link } from 'react-router-dom';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CertificateManager } from '@/components/terminal/CertificateManager';

interface BiddingItem {
    itemId: string;
    valorAtual: number;
    valorEstimado?: number;
    ganhador: string;
    status: string;
    position: number;
    tempoRestante: number;
}

interface ItemStrategy {
    mode: 'follower' | 'sniper' | 'cover' | 'shadow';
    minPrice: number;
    decrementValue: number;
    decrementType: 'fixed' | 'percent';
}

export default function BiddingDashboardPage() {
    const { currentUser: authUser } = useAuthStore();
    const [searchParams] = useSearchParams();
    
    const [uasg, setUasg] = useState('');
    const [numeroPregao, setNumeroPregao] = useState('');
    const [anoPregao, setAnoPregao] = useState(new Date().getFullYear().toString());
    const [turbo, setTurbo] = useState<boolean>(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [items, setItems] = useState<BiddingItem[]>([]);
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);
    const [itemStrategies, setItemStrategies] = useState<Record<string, ItemStrategy>>({});
    const [simulationMode, setSimulationMode] = useState(true);
    const { credentials, fetchCredentials: fetchVaultCredentials } = useVaultStore();
    const [selectedCredentialId, setSelectedCredentialId] = useState<string>('');
    const [modality, setModality] = useState<string>('05'); // Default: 05 - Pregão
    const [actionLogs, setActionLogs] = useState<any[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showRealModeWarning, setShowRealModeWarning] = useState(false);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [serverOffset, setServerOffset] = useState(0);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [coveredItems, setCoveredItems] = useState<Set<string>>(new Set());
    const [isDesktop] = useState(!!(window as any).electronAPI?.isDesktop);
    const [isLocalRunning, setIsLocalRunning] = useState(false);

    // MODO MULTI-UASG (v2.0 War Flow)
    const [viewMode, setViewMode] = useState<'focus' | 'grid' | 'flow'>('focus');
    const [sessions, setSessions] = useState<Record<string, {
        uasg: string;
        numero: string;
        items: BiddingItem[];
        chatMessages: any[];
        lastUpdate: string;
        isAuthenticated: boolean;
        simulationMode: boolean;
    }>>({});

    const dummyCredentialId = 'simulated-credential-id';

    const startRadar = async (overrideUasg?: string, overrideNum?: string, overrideAno?: string) => {
        const targetUasg = overrideUasg || uasg;
        const targetNum = overrideNum || numeroPregao;
        const targetAno = overrideAno || anoPregao;

        if (!targetUasg || !targetNum) {
            import('sonner').then(({ toast }) => toast.error("Preencha UASG e Nº do Pregão."));
            return;
        }
        
        try {
            // Se for Desktop, tentamos rodar LOCALMENTE
            if (isDesktop && (window as any).electronAPI) {
                const api = (window as any).api || (await import('@/lib/api')).default;
                
                // 1. Criar sessão no servidor (para herdar as estratégias salvas)
                const res = await api.post('/bidding/sessions', {
                    credentialId: selectedCredentialId || dummyCredentialId,
                    portal: 'compras_gov',
                    uasg: targetUasg,
                    numeroPregao: targetNum,
                    anoPregao: targetAno
                });

                if (res.data.success) {
                    const session = res.data.session;
                    setSessionId(session.id);

                    // 2. Chamar o Motor Visual na versão Desktop
                    if (isDesktop && (window as any).electronAPI) {
                        (window as any).electronAPI.startVisualBidding({
                            sessionId: session.id,
                            uasg: targetUasg.trim(),
                            numero: targetNum.trim(),
                            ano: targetAno.trim(),
                            vault: {
                                simulationMode,
                                itemsConfig: itemStrategies
                            },
                            modality
                        });
                        setIsLocalRunning(true);
                        setIsListening(true);
                        
                        // v2.0: Auto-switch to Flow mode when moving to multi-uasg
                        if (Object.keys(sessions).length > 0) {
                            setViewMode('flow');
                        }

                        // Inicializa na lista multi-sessão
                        setSessions(prev => ({
                            ...prev,
                            [session.id]: {
                                uasg: targetUasg,
                                numero: targetNum,
                                items: [],
                                chatMessages: [],
                                lastUpdate: new Date().toLocaleTimeString(),
                                isAuthenticated: true,
                                simulationMode: true
                            }
                        }));

                        toast.success(`Robô ${targetUasg} Iniciado! 👁️`);
                        return;
                    }
                    
                    // Fallback para modo nuvem se o vault falhar ou não houver credencial real
                    toast.info("Iniciando via Nuvem (Apenas leitura sem automação visual)...");
                }
            }

            // MODO CLOUD (Original)
            const res = await api.post('/bidding/sessions', {
                credentialId: selectedCredentialId || dummyCredentialId,
                portal: 'compras_gov',
                uasg: targetUasg,
                numeroPregao: targetNum,
                anoPregao: targetAno
            });
            
            const data = res.data;
            
            if (data.success) {
                const newSessionId = data.session.id;
                setSessionId(newSessionId);
                
                if (socketService) {
                    socketService.emit('join_bidding_room', newSessionId);
                }

                await api.post(`/bidding/sessions/${newSessionId}/start`);
                setIsListening(true);
                toast.success("Radar Polaryon NUVEM ativado com sucesso! ☁️");
            }
        } catch (error: any) {
            console.error("Failed to start radar:", error);
            const msg = error.response?.data?.error || "Erro ao conectar com o servidor de lances.";
            toast.error(msg);
        }
    };

    // v2.0 War Flow - Unified Item List
    const allItems = useMemo(() => {
        const list: (BiddingItem & { sid: string, uasgName: string })[] = [];
        Object.entries(sessions).forEach(([sid, session]) => {
            (session.items || []).forEach(item => {
                list.push({ ...item, sid, uasgName: session.uasg });
            });
        });

        // Ordenação inteligente: Perdedores e Urgentes primeiro
        return list.sort((a, b) => {
            const aIsWinning = a.posicao === '1';
            const bIsWinning = b.posicao === '1';
            
            if (!aIsWinning && bIsWinning) return -1;
            if (aIsWinning && !bIsWinning) return 1;
            
            // Se ambos estão no mesmo status, os com menos tempo vem primeiro
            return (a.timerSeconds || 9999) - (b.timerSeconds || 9999);
        });
    }, [sessions]);

    const stopRadar = async () => {
        if (!sessionId) return;
        try {
            if (isLocalRunning && (window as any).electronAPI) {
                (window as any).electronAPI.stopVisualBidding(sessionId);
                setIsLocalRunning(false);
            } else {
                await api.post(`/bidding/sessions/${sessionId}/stop`);
                if (socketService) {
                    socketService.emit('leave_bidding_room', sessionId);
                }
            }
            setIsListening(false);
            setSessionId(null);
        } catch (error) {
            console.error("Failed to stop radar:", error);
        }
    };

    const focusBiddingWindow = () => {
        if (isDesktop && (window as any).electronAPI && sessionId) {
            (window as any).electronAPI.focusVisualBidding(sessionId);
        }
    };

    const navigateToRoom = () => {
        if (isDesktop && (window as any).electronAPI && sessionId) {
            (window as any).electronAPI.navigateVisualBidding(sessionId);
        }
    };

    useEffect(() => {
        const syncVault = async () => {
            try {
                const profileRes = await api.get('/kanban/main-companies');
                const defaultCompany = profileRes.data.find((p: any) => p.isDefault) || profileRes.data[0];
                if (defaultCompany) {
                    await fetchVaultCredentials(defaultCompany.id);
                }
            } catch (e) {
                console.error("Failed to sync vault", e);
            }
        };
        syncVault();
    }, [fetchVaultCredentials]);

    // Update selected credential if none selected
    useEffect(() => {
        if (credentials.length > 0 && !selectedCredentialId) {
            setSelectedCredentialId(credentials[0].id);
        }
    }, [credentials, selectedCredentialId]);

    // Radar Integration: Capture params from URL
    // Radar Integration: Capture params from URL
    useEffect(() => {
        const uasgParam = searchParams.get('uasg');
        const numeroParam = searchParams.get('numero');
        const anoParam = searchParams.get('ano');
        const autoStart = searchParams.get('autoStart') === 'true';

        if (uasgParam) setUasg(uasgParam);
        if (numeroParam) setNumeroPregao(numeroParam);
        if (anoParam) setAnoPregao(anoParam);
        
        if (uasgParam && numeroParam) {
            if (autoStart && isDesktop) {
                 import('sonner').then(({ toast }) => toast.success("Auto-Iniciando Máquina de Lances..."));
                 setTimeout(() => {
                     startRadar(uasgParam, numeroParam, anoParam || new Date().getFullYear().toString());
                 }, 500);
            } else {
                 import('sonner').then(({ toast }) => toast.info("Dados do Radar carregados com sucesso."));
            }
        }
    }, [searchParams]);

    // ELECTRON LOCAL RUNNER LISTENER
    useEffect(() => {
        if (isDesktop && (window as any).electronAPI) {
            const handleUpdate = (data: any) => {
                const { sessionId: sid, items: newItems, timestamp, turbo: isTurbo } = data;
                
                // Atualiza Global (se for a sessão focada)
                if (sid === sessionId) {
                    setItems(newItems);
                    setLastUpdate(timestamp);
                    if (isTurbo !== undefined) setTurbo(isTurbo);
                }

                // Atualiza Registro Multi-Sessão
                setSessions(prev => ({
                    ...prev,
                    [sid]: {
                        ...prev[sid],
                        items: newItems,
                        lastUpdate: timestamp
                    }
                }));
            };
            
            const handleChat = (data: any) => {
                const { sessionId: sid, messages } = data;
                if (sid === sessionId) {
                    setChatMessages(messages);
                }
                setSessions(prev => ({
                    ...prev,
                    [sid]: {
                        ...prev[sid],
                        chatMessages: messages
                    }
                }));
            };
            
            (window as any).electronAPI.onBiddingUpdate(handleUpdate);
            (window as any).electronAPI.onBiddingChat(handleChat);

            // Reativar sessões se existirem no store local
            const restore = async () => {
                const activeSessions = await (window as any).electronAPI.getRestoredSessions();
                const sessionIds = Object.keys(activeSessions);
                
                if (sessionIds.length > 0) {
                    toast.info(`Retomando ${sessionIds.length} sessões anteriores...`);
                    
                    for (const id of sessionIds) {
                        const s = activeSessions[id];
                        const credId = s.vault?.credentialId;

                        if (credId) {
                            try {
                                const vaultRes = await api.get(`/bidding/credentials/${credId}/vault`);
                                if (vaultRes.data.success) {
                                    (window as any).electronAPI.startLocalBidding({
                                        sessionId: id,
                                        uasg: s.uasg,
                                        numero: s.numero,
                                        ano: s.ano || new Date().getFullYear().toString(),
                                        vault: {
                                            ...vaultRes.data.vault,
                                            itemsConfig: s.vault.itemsConfig,
                                            simulationMode: s.vault.simulationMode
                                        }
                                    });
                                    
                                    setUasg(s.uasg);
                                    setNumeroPregao(s.numero);
                                    setSessionId(id);
                                    setIsLocalRunning(true);
                                    setIsListening(true);
                                    toast.success(`Sessão ${s.uasg} retomada com sucesso! ⚡`);
                                }
                            } catch (e) {
                                console.error(`Failed to resume session ${id}`, e);
                            }
                        }
                    }
                }
            };
            restore();
        }
    }, [isDesktop, sessionId]);

    const saveStrategy = async (itemId: string, strategy: ItemStrategy, targetSid?: string) => {
        const sid = targetSid || sessionId;
        if (!sid) return;
        try {
            await api.patch(`/bidding/sessions/${sid}/items/${itemId}`, {
                ...strategy,
                simulationMode 
            });
            
            // Atualiza estratégias locais
            setItemStrategies(prev => ({ ...prev, [itemId]: strategy }));

            // ⚡ NOTIFY LOCAL ENGINE (Real-time Config Sync)
            if (isLocalRunning && (window as any).electronAPI) {
                (window as any).electronAPI.updateLocalBiddingConfig(
                    sid,
                    {
                        itemsConfig: {
                            ...itemStrategies,
                            [itemId]: strategy
                        }
                    }
                );
            }
        } catch (error) {
            console.error("Failed to save strategy:", error);
        }
    };

    // Toggle Simulation Mode for the whole session
    const toggleSimulation = async (val: boolean) => {
        setSimulationMode(val);
        if (sessionId) {
            try {
                // Update special key to sync global simulation mode
                await api.patch(`/bidding/sessions/${sessionId}/items/__global__`, { simulationMode: val });
                
                // ⚡ NOTIFY LOCAL ENGINE (Real-time Simulation Toggle)
                if (isLocalRunning && (window as any).electronAPI) {
                    (window as any).electronAPI.updateLocalBiddingConfig(
                        sessionId,
                        { simulationMode: val }
                    );
                }

                import('sonner').then(({ toast }) => toast.info(`Modo ${val ? 'SIMULADO' : 'REAL'} ativado.`));
            } catch (e) {
                console.error("Failed to sync simulation mode", e);
                // import('sonner').then(({ toast }) => toast.error("Erro ao sincronizar modo de simulação."));
            }
        }
    };

    useEffect(() => {
        if (!socketService) return;

        const handleUpdate = (data: any) => {
            setItems(data.items);
            if (data.actions && data.actions.length > 0) {
                setActionLogs(prev => [...data.actions, ...prev].slice(0, 100));
            }
            if (data.isAuthenticated !== undefined) {
                setIsAuthenticated(data.isAuthenticated);
            }
            if (data.serverOffset !== undefined) {
                setServerOffset(data.serverOffset);
            }
            setLastUpdate(new Date().toLocaleTimeString());
        };

        const handleChat = (data: any) => {
            if (data.messages) {
                setChatMessages(data.messages);
            }
        };

        const handleAlert = (alert: any) => {
            if (alert.type === 'BID_COVERED') {
                const itemIdStr = alert.message.match(/Item (\d+)/)?.[1];
                if (itemIdStr) {
                    setCoveredItems(prev => new Set(prev).add(itemIdStr));
                    setTimeout(() => {
                        setCoveredItems(prev => {
                            const next = new Set(prev);
                            next.delete(itemIdStr);
                            return next;
                        });
                    }, 3000);
                }
            }
            import('sonner').then(({ toast }) => {
                if (alert.critical) {
                    toast.error(alert.message, { duration: 10000 });
                } else {
                    toast.warning(alert.message);
                }
            });
        };

        socketService.on('biddingUpdate', handleUpdate);
        socketService.on('biddingChat', handleChat);
        socketService.on('bidding_alert', handleAlert);

        return () => {
            socketService.off('biddingUpdate', handleUpdate);
            socketService.off('biddingChat', handleChat);
            socketService.off('bidding_alert', handleAlert);
        };
    }, [socketService, sessionId, isListening]);

    const applyBulkStrategy = async (strategy: ItemStrategy) => {
        if (!sessionId || selectedItems.size === 0) return;
        try {
            await api.patch(`/bidding/sessions/${sessionId}/items/bulk`, {
                itemIds: Array.from(selectedItems),
                config: strategy
            });
            
            // Local state update
            const newStrategies = { ...itemStrategies };
            selectedItems.forEach(id => {
                newStrategies[id] = strategy;
            });
            setItemStrategies(newStrategies);
            setSelectedItems(new Set());
            toast.success(`Estratégia aplicada a ${selectedItems.size} itens!`);
        } catch (error) {
            console.error("Failed to apply bulk strategy:", error);
            toast.error("Erro ao aplicar estratégia em massa.");
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent uppercase">
                            POLARYON TERMINAL
                        </h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1 italic">
                            Military Grade Bidding Automation
                        </p>
                    </div>

                    <div className="h-10 w-[1px] bg-white/10 hidden md:block"></div>

                    {/* VIEW SWITCHER (v1.8.0) */}
                    <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
                        <Button 
                            variant={viewMode === 'focus' ? 'secondary' : 'ghost'} 
                            onClick={() => setViewMode('focus')}
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest rounded-lg"
                        >
                            FOCADO
                        </Button>
                        <Button 
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                            onClick={() => setViewMode('grid')}
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest rounded-lg"
                        >
                            GRADES ({Object.keys(sessions).length})
                        </Button>
                        <Button 
                            variant={viewMode === 'flow' ? 'secondary' : 'ghost'} 
                            onClick={() => setViewMode('flow')}
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest rounded-lg bg-emerald-500/10 text-emerald-500"
                        >
                            FLUXO
                        </Button>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-black uppercase">Vencendo</span>
                            <span className="text-xl font-black text-emerald-500">{items.filter(i => i.ganhador === 'Você').length}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-black uppercase">Economia</span>
                            <span className="text-xl font-black text-cyan-400">R$ {items.reduce((acc, i) => acc + (i.ganhador === 'Você' ? (i.valorEstimado || 0) - i.valorAtual : 0), 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                {isListening && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-6 px-4 py-2 bg-slate-900/60 rounded-xl border border-white/5 divide-x divide-white/10">
                            <div className="flex flex-col pr-4">
                                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Latência</span>
                                <span className="text-xs font-mono text-emerald-400">12ms</span>
                            </div>
                            <div className="flex flex-col px-4">
                                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Sincronicidade</span>
                                <span className="text-xs font-mono text-cyan-400">100%</span>
                            </div>
                            <div className="flex flex-col pl-4 text-right">
                                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Modo</span>
                                <span className="text-xs font-black text-amber-500">{simulationMode ? 'SIMULAÇÃO' : 'REAL'}</span>
                            </div>
                        </div>

                        {turbo && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 rounded-full border border-red-500/20 animate-pulse">
                                <Zap className="w-3 h-3 fill-current" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Ultra Latency</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3 px-6 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                            <span className="text-sm font-bold uppercase tracking-widest">Radar Ativo</span>
                        </div>
                    </div>
                )}
            </div>

            {viewMode === 'flow' ? (
                <div className="space-y-4 max-w-5xl mx-auto pb-20">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-black text-white italic tracking-tighter">FLUXO DE COMBATE</h2>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Monitorando {allItems.length} itens simultâneos</p>
                        </div>
                    </div>
                    {allItems.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
                            <Target className="w-12 h-12 text-slate-700 animate-pulse mb-4" />
                            <p className="text-slate-500 font-bold text-sm">Nenhum item ativo no fluxo.</p>
                            <p className="text-slate-700 text-[10px] mt-1 uppercase">Inicie o radar em um UASG para ver os itens aqui.</p>
                        </div>
                    ) : (
                        allItems.map(item => (
                            <CombatStreamCard 
                                key={`${item.sid}-${item.id}`} 
                                item={item} 
                                sessionId={item.sid}
                                strategy={itemStrategies[item.id] || { mode: 'follower', minPrice: 0 }}
                                onSave={(s) => saveStrategy(item.id, s, item.sid)}
                            />
                        ))
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-8 duration-500">
                    {Object.entries(sessions).map(([sid, s]) => (
                        <Card 
                            key={sid} 
                            onClick={() => {
                                setSessionId(sid);
                                setUasg(s.uasg);
                                setNumeroPregao(s.numero);
                                setItems(s.items);
                                setChatMessages(s.chatMessages);
                                setViewMode('focus');
                            }}
                            className={`group cursor-pointer shadow-xl border-none bg-slate-900/40 backdrop-blur-xl ring-1 transition-all hover:scale-[1.02] hover:ring-emerald-500/50 ${
                                sessionId === sid ? 'ring-emerald-500' : 'ring-white/10'
                            }`}
                        >
                            <div className={`h-1 w-full ${s.items.some(i => i.ganhador === 'Você') ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                            <CardHeader className="p-4 pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <CardTitle className="text-lg font-black tracking-tighter text-slate-100">UASG {s.uasg}</CardTitle>
                                        <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Pregão {s.numero}</CardDescription>
                                    </div>
                                    {s.items.some(i => i.tempoRestante > 0) && (
                                        <span className="flex items-center gap-1 text-[10px] text-red-500 font-black animate-pulse">
                                            <Activity className="w-3 h-3" /> ATIVO
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-2">
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-slate-950/50 p-2 rounded-lg border border-white/5">
                                        <p className="text-[8px] text-slate-500 font-bold uppercase mb-1">Itens</p>
                                        <p className="text-sm font-black text-slate-200">{s.items.length}</p>
                                    </div>
                                    <div className="bg-slate-950/50 p-2 rounded-lg border border-white/5">
                                        <p className="text-[8px] text-slate-500 font-bold uppercase mb-1">Vencendo</p>
                                        <p className="text-sm font-black text-emerald-500">{s.items.filter(i => i.ganhador === 'Você').length}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-[9px] font-mono text-slate-600">
                                    <span>Sync: {s.lastUpdate}</span>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${s.isAuthenticated ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                        <span>{s.isAuthenticated ? 'ONLINE' : 'AUTH'}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    
                    {/* Botão de Adicionar na Grade */}
                    <Card 
                        onClick={() => {
                            // Reset para nova operação: limpa campos e sessão ativa
                            setUasg('');
                            setNumeroPregao('');
                            setAnoPregao(new Date().getFullYear().toString());
                            setItems([]);
                            setChatMessages([]);
                            setSessionId(null); // Deseleciona sessão atual para não confundir o FOCADO
                            setIsListening(false);
                            setIsLocalRunning(false);
                            setViewMode('focus');
                        }}
                        className="flex items-center justify-center border-dashed border-2 border-emerald-500/30 bg-transparent hover:bg-emerald-500/5 cursor-pointer transition-colors min-h-[150px]"
                    >
                        <div className="flex flex-col items-center gap-2 text-emerald-500/70 group-hover:text-emerald-400 transition-colors">
                            <PlusIcon className="w-8 h-8" />
                            <span className="text-[11px] font-black uppercase tracking-widest">Nova Operação</span>
                            <span className="text-[8px] text-white/20 uppercase">Sessão independente</span>
                        </div>
                    </Card>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Controls Card */}
                <Card className="lg:col-span-1 shadow-2xl border-none bg-slate-900/40 backdrop-blur-xl ring-1 ring-white/10 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-slate-100">
                            <Target className="w-5 h-5 text-emerald-500"/> Configuração
                        </CardTitle>
                        <CardDescription className="text-slate-400">Defina os parâmetros do pregão.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider">UASG / Código do Órgão</Label>
                            <Input 
                                value={uasg} 
                                onChange={e => setUasg(e.target.value)} 
                                placeholder="Ex: 160045" 
                                disabled={isListening} 
                                className="bg-slate-950/50 border-white/10 text-slate-100 h-11 focus:ring-emerald-500/50" 
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider">Nº Pregão / Dispensa</Label>
                                <Input 
                                    value={numeroPregao} 
                                    onChange={e => setNumeroPregao(e.target.value)} 
                                    placeholder="Ex: 6" 
                                    disabled={isListening} 
                                    className="bg-slate-950/50 border-white/10 text-slate-100 h-11" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider">Ano</Label>
                                <Input 
                                    value={anoPregao} 
                                    onChange={e => setAnoPregao(e.target.value)} 
                                    disabled={isListening} 
                                    className="bg-slate-950/50 border-white/10 text-slate-100 h-11" 
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider">Modalidade de Compra</Label>
                            <Select value={modality} onValueChange={setModality} disabled={isListening}>
                                <SelectTrigger className="bg-slate-950/50 border-white/10 text-slate-100 h-11">
                                    <SelectValue placeholder="Selecione a modalidade" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10 text-white">
                                    <SelectItem value="05">PE - Pregão Eletrônico (05)</SelectItem>
                                    <SelectItem value="14">DE - Dispensa Eletrônica (Lei 14.133)</SelectItem>
                                    <SelectItem value="06">DE - Dispensa Eletrônica (06 - Antiga Lei)</SelectItem>
                                    <SelectItem value="01">CV - Convite (01)</SelectItem>
                                    <SelectItem value="02">TP - Tomada de Preço (02)</SelectItem>
                                    <SelectItem value="03">CC - Concorrência (03)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-4 pt-2 border-t border-white/5 mt-4">
                            <div className="flex items-center justify-between p-3 bg-slate-950/30 rounded-xl border border-white/5">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-bold text-slate-300">MODO SIMULAÇÃO</Label>
                                    <p className="text-[10px] text-slate-500">Não envia lances reais</p>
                                </div>
                                <Switch 
                                    checked={simulationMode} 
                                    onCheckedChange={(val) => {
                                        if (!val) {
                                            setShowRealModeWarning(true);
                                        } else {
                                            toggleSimulation(true);
                                        }
                                    }}
                                    className="data-[state=checked]:bg-amber-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                                    <span className="flex items-center gap-2"><Key className="w-3 h-3" /> Conta de Disputa</span>
                                    {isAuthenticated && (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-black animate-pulse">
                                            <CheckCircle2 className="w-3 h-3" /> AUTENTICADO
                                        </span>
                                    )}
                                </Label>
                                <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId} disabled={isListening}>
                                    <SelectTrigger className="bg-slate-950/50 border-white/10 text-slate-100 h-11">
                                        <SelectValue placeholder="Selecione um certificado..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-white/10 text-slate-100">
                                        {credentials.length === 0 && (
                                            <div className="p-4 text-center">
                                                <p className="text-[10px] text-slate-500 mb-2">Sem certificados cadastrados</p>
                                                <Link to="/seguranca/cofre">
                                                    <Button size="sm" className="w-full text-[10px] h-7 bg-emerald-600 hover:bg-emerald-500">
                                                        CONFIGURAR COFRE
                                                    </Button>
                                                </Link>
                                            </div>
                                        )}
                                        {credentials.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                                                {c.alias} ({c.cnpj})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="pt-4 space-y-4">
                            {isDesktop && <CertificateManager />}
                            
                            {!isListening ? (
                                <Button onClick={() => startRadar()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 shadow-emerald-900/20 shadow-xl transition-all hover:scale-[1.02] active:scale-95">
                                    <Play className="w-4 h-4 mr-2 fill-current"/> INICIAR COMBATE
                                </Button>
                            ) : (
                                <Button onClick={() => stopRadar()} variant="destructive" className="w-full font-bold h-12 shadow-red-900/20 shadow-xl transition-all hover:scale-[1.02] active:scale-95">
                                    <Square className="w-4 h-4 mr-2 fill-current"/> ABORTAR MISSÃO
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Dashboard Monitor */}
                <Card className="lg:col-span-2 shadow-2xl border-none bg-slate-900/40 backdrop-blur-xl ring-1 ring-white/10 overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/5">
                        <div>
                            <CardTitle className="text-xl text-slate-100">Sala de Disputa</CardTitle>
                            <CardDescription className="text-slate-400">Monitoramento da sala de lances.</CardDescription>
                        </div>
                        <div className="text-right">
                             <div className="text-[10px] font-mono text-emerald-500/70 uppercase tracking-widest">Último Sync: {lastUpdate || '--:--:--'}</div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 relative min-h-[400px]">
                        {!isListening ? (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                                <Activity className="w-12 h-12 text-slate-700 mb-4 opacity-50" />
                                <p className="font-bold text-slate-500 text-xs">SISTEMA EM STANDBY</p>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                                            {selectedItems.size > 0 && (
                                    <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between animate-in slide-in-from-top duration-300">
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => focusBiddingWindow()} className="bg-slate-900 border-white/10 text-xs font-bold h-7">
                                                <Target className="w-3 h-3 mr-1" /> FOCAR JANELA
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => navigateToRoom()} className="bg-slate-900 border-white/10 text-xs font-bold h-7">
                                                <RefreshCw className="w-3 h-3 mr-1" /> VOLTAR P/ SALA
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-black text-emerald-500">{selectedItems.size} ITENS SELECIONADOS</span>
                                            
                                            <StrategyModal 
                                                item={{ itemId: 'MASS' } as any}
                                                initialStrategy={{ mode: 'follower', minPrice: 0.10, decrementValue: 0.05, decrementType: 'fixed' }}
                                                onSave={applyBulkStrategy}
                                                isBulk
                                            />
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())} className="text-xs text-slate-500">Cancelar</Button>
                                    </div>
                                )}

                                <div className="divide-y divide-white/5">
                                    {items.map(item => {
                                        const strategy = itemStrategies[item.itemId] || { mode: 'follower', minPrice: 0, decrementValue: 0.10, decrementType: 'fixed' };
                                        const isSelected = selectedItems.has(item.itemId);
                                        const isCovered = coveredItems.has(item.itemId);
                                        
                                        return (
                                            <div 
                                                key={item.itemId} 
                                                className={`p-3 md:p-4 flex items-center justify-between transition-all group ${
                                                    item.ganhador === 'Você' ? 'bg-emerald-500/[0.03]' : 'bg-transparent'
                                                } ${isCovered ? 'bg-red-500/10 animate-pulse ring-1 ring-red-500/40' : ''}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <Checkbox 
                                                        checked={isSelected}
                                                        onCheckedChange={(val) => {
                                                            const next = new Set(selectedItems);
                                                            if (val) next.add(item.itemId);
                                                            else next.delete(item.itemId);
                                                            setSelectedItems(next);
                                                        }}
                                                        className="border-white/20 data-[state=checked]:bg-emerald-500"
                                                    />

                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-slate-100 uppercase tracking-tighter">ITEM {item.itemId}</span>
                                                            {item.position > 0 && (
                                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                                                    item.position === 1 ? 'bg-emerald-500 text-black' : 'bg-slate-700 text-slate-300'
                                                                }`}>
                                                                    {item.position}º
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${
                                                                strategy.mode === 'shadow' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-slate-800 text-slate-500 border-white/5'
                                                            }`}>
                                                                {strategy.mode === 'shadow' ? 'SOMBRA (2º)' : strategy.mode.toUpperCase()}
                                                            </span>
                                                            
                                                            {/* MARGIN INDICATOR */}
                                                            {strategy.minPrice > 0 && item.valorAtual <= strategy.minPrice ? (
                                                                <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded animate-pulse">
                                                                    LIMITE ATINGIDO
                                                                </span>
                                                            ) : strategy.minPrice > 0 ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className="h-full bg-emerald-500" 
                                                                            style={{ width: `${Math.min(100, Math.max(0, ((item.valorAtual - strategy.minPrice) / item.valorAtual) * 100))}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="text-[8px] text-slate-500 font-bold uppercase">Margem OK</span>
                                                                </div>
                                                            ) : null}

                                                            {item.tempoRestante > 0 && (
                                                                <span className="text-[9px] font-black text-red-500 flex items-center gap-1">
                                                                    <Activity className="w-2.5 h-2.5 animate-spin"/> {item.tempoRestante}s
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                       <div className="flex items-center gap-6">
                                                    {/* INPUT DE VALOR MÍNIMO (FLOOR PRICE) */}
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">LIMITE (R$)</span>
                                                        <Input 
                                                            type="number"
                                                            value={strategy.minPrice}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                saveStrategy(item.itemId, { ...strategy, minPrice: val });
                                                            }}
                                                            className="w-24 h-9 bg-slate-950/50 border-white/5 text-xs font-bold text-emerald-500 focus:ring-emerald-500/50"
                                                        />
                                                    </div>

                                                    <div className="text-right flex flex-col items-end">
                                                        <div className={`text-xl font-black tabular-nums tracking-tighter ${
                                                            item.ganhador === 'Você' ? 'text-emerald-400' : 'text-amber-500 font-bold'
                                                        }`}>
                                                            R$ {item.valorAtual.toFixed(2)}
                                                        </div>
                                                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{item.ganhador}</span>
                                                    </div>

                                                    <StrategyModal 
                                                        item={item} 
                                                        initialStrategy={strategy} 
                                                        onSave={(s) => saveStrategy(item.itemId, s)} 
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Chat Panel Card */}
                <Card className="lg:col-span-1 shadow-2xl border-none bg-slate-900/40 backdrop-blur-xl ring-1 ring-white/10 overflow-hidden relative flex flex-col h-full max-h-[600px]">
                    <CardHeader className="pb-3 border-b border-white/5 bg-slate-950/20">
                        <CardTitle className="flex items-center gap-2 text-slate-100 text-lg">
                            <Zap className="w-5 h-5 text-amber-500"/> Chat do Pregoeiro
                        </CardTitle>
                        <CardDescription className="text-slate-400">Mensagens oficiais da sessão.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto px-4 space-y-4 pt-4 custom-scrollbar bg-slate-950/10">
                        {chatMessages.length === 0 ? (
                            <div className="text-center py-12 text-slate-600">
                                <Activity className="w-8 h-8 mx-auto opacity-20 mb-2" />
                                <p className="text-xs font-medium">Aguardando mensagens...</p>
                            </div>
                        ) : (
                            chatMessages.map((msg, idx) => {
                                const isOfficial = msg.tipo === 'OFICIAL' || msg.enviadoPeloPregoeiro;
                                return (
                                    <div key={idx} className={`p-3 rounded-2xl text-[11px] leading-relaxed shadow-sm ${
                                        isOfficial 
                                        ? 'bg-amber-500/10 border-l-2 border-amber-500 text-slate-200 ml-0 mr-4' 
                                        : 'bg-slate-800/40 border-l-2 border-slate-600 text-slate-400 ml-4 mr-0'
                                    }`}>
                                        <div className="flex items-center justify-between mb-1 opacity-60 font-bold uppercase tracking-tighter text-[9px]">
                                            <span>{isOfficial ? 'PREGOEIRO' : (msg.apelido || 'SISTEMA')}</span>
                                            <span>{msg.dataEnvio ? new Date(msg.dataEnvio).toLocaleTimeString() : ''}</span>
                                        </div>
                                        <p className="font-medium">{msg.texto}</p>
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>

                {/* Action Logs Card */}
                <Card className="lg:col-span-1 shadow-2xl border-none bg-slate-900/40 backdrop-blur-xl ring-1 ring-white/10 overflow-hidden relative flex flex-col h-full max-h-[600px]">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-slate-100 text-lg">
                            <History className="w-5 h-5 text-indigo-400"/> Histórico de Combate
                        </CardTitle>
                        <CardDescription className="text-slate-400">Últimas ações do robô.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto px-4 space-y-3 pb-6 custom-scrollbar">
                        {actionLogs.length === 0 ? (
                            <div className="text-center py-12 text-slate-600">
                                <Activity className="w-8 h-8 mx-auto opacity-20 mb-2" />
                                <p className="text-xs font-medium">Nenhuma ação registrada.</p>
                            </div>
                        ) : (
                            actionLogs.map((log, idx) => (
                                <div key={idx} className="group relative p-3 bg-slate-950/50 rounded-xl border border-white/5 space-y-1.5 animate-in slide-in-from-right-4 duration-300 hover:border-emerald-500/30 transition-colors">
                                    <div className="absolute -left-[1px] top-3 w-[2px] h-6 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded tracking-tighter ${log.type === 'SIMULATED' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                {log.type === 'SIMULATED' ? 'SIM' : 'REAL'}
                                            </span>
                                            {log.status === 'error' && (
                                                <AlertTriangle className="w-3 h-3 text-red-500" />
                                            )}
                                            <span className="text-[10px] text-slate-500 font-black">ITEM {log.itemId}</span>
                                        </div>
                                        <span className="text-[8px] font-mono text-slate-600">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className={`text-xs font-black tabular-nums ${log.status === 'error' ? 'text-red-400' : 'text-slate-100'}`}>
                                            R$ {log.value.toFixed(2)}
                                        </p>
                                        <span className="text-[9px] text-slate-500 uppercase font-black">{log.reason || 'Sincronizado'}</span>
                                    </div>
                                    {log.error && (
                                        <p className="text-[9px] text-red-400/70 italic border-t border-white/5 pt-1 mt-1 truncate">
                                            ERR: {log.error}
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
                </div>
            )}

            <AlertDialog open={showRealModeWarning} onOpenChange={setShowRealModeWarning}>
                <AlertDialogContent className="bg-slate-900 border-white/10 text-slate-100">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-500">
                            <ShieldAlert className="w-5 h-5" /> ATENÇÃO: MODO REAL ATIVADO
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            Ao desativar o modo simulação, o robô irá realizar lances REAIS no portal Gov.br usando seu Certificado Digital. Estes lances têm validade jurídica e financeira.
                            <br /><br />
                            Deseja prosseguir com a operação real?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700">CANCELAR</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={() => toggleSimulation(false)}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold"
                        >
                            SIM, ATIVAR MODO REAL
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// v2.0 - COMPONENTE DE ELITE PARA FLUXO DE COMBATE
function CombatStreamCard({ item, sessionId, strategy, onSave }: { item: BiddingItem & { uasgName: string }, sessionId: string, strategy: ItemStrategy, onSave: (s: ItemStrategy) => void }) {
    const isWinning = item.posicao === '1';
    const [localMinPrice, setLocalMinPrice] = useState(strategy.minPrice.toString());

    return (
        <Card className={`relative overflow-hidden border-2 transition-all duration-300 ${isWinning ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : 'border-red-500/30 bg-red-500/[0.03] shadow-[0_0_20px_rgba(239,68,68,0.05)]'}`}>
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-800" />
            <div className={`absolute top-0 left-0 w-1 h-full animate-pulse ${isWinning ? 'bg-emerald-500' : 'bg-red-500'}`} />
            
            <CardContent className="p-4">
                <div className="grid grid-cols-12 gap-4 items-center">
                    {/* STATUS E IDENTIFICAÇÃO */}
                    <div className="col-span-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-500 tracking-tighter uppercase whitespace-nowrap">
                                Item {item.id} • UASG {item.uasgName}
                            </span>
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-black italic tracking-tight w-fit ${isWinning ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                                {isWinning ? <Trophy className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                {isWinning ? 'VENCENDO' : 'PERDENDO'}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold truncate mt-1">{item.descricao}</span>
                        </div>
                    </div>

                    {/* LANCE E VALOR */}
                    <div className="col-span-4 flex flex-col items-center justify-center border-l border-r border-white/10 px-4">
                        <span className="text-[10px] text-slate-500 font-black uppercase mb-1">Meu Lance Atual</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-slate-400 text-xs font-bold leading-none">R$</span>
                            <span className={`text-2xl font-black italic tracking-tighter leading-none ${isWinning ? 'text-emerald-400' : 'text-red-400'}`}>
                                {item.melhorLance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold mt-1">
                            Vencedor: R$ {item.valorVencedor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    {/* TIMER DE COMBATE */}
                    <div className="col-span-2 flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 font-black uppercase mb-1">Tempo</span>
                        <div className={`text-xl font-mono font-black tracking-tighter tabular-nums ${item.timerSeconds && item.timerSeconds < 30 ? 'text-orange-500 animate-pulse' : 'text-white'}`}>
                            {item.timeout || '00:00'}
                        </div>
                        <div className="w-full bg-slate-900 h-1 mt-2 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-1000 ${isWinning ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(((item.timerSeconds || 0) / 180) * 100, 100)}%` }}
                             />
                        </div>
                    </div>

                    {/* CONTROLES SNIPER (v2.0) */}
                    <div className="col-span-3 pl-4 flex flex-col gap-2">
                        <div className="flex flex-col gap-1.5">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={strategy.mode === 'follower'}
                                    onChange={(e) => onSave({ ...strategy, mode: e.target.checked ? 'follower' : 'manual' })}
                                    className="w-4 h-4 rounded border-white/20 bg-slate-900 accent-emerald-500"
                                />
                                <span className="text-[11px] font-black text-slate-300 group-hover:text-emerald-400 transition-colors uppercase italic">Manter Aberto</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={strategy.mode === 'sniper'}
                                    onChange={(e) => onSave({ ...strategy, mode: e.target.checked ? 'sniper' : 'manual' })}
                                    className="w-4 h-4 rounded border-white/20 bg-slate-900 accent-orange-500"
                                />
                                <span className="text-[11px] font-black text-slate-300 group-hover:text-orange-400 transition-colors uppercase italic">Modo Sniper</span>
                            </label>
                        </div>

                        <div className="relative group">
                            <span className="absolute -top-2 left-2 bg-slate-900 px-1 text-[8px] font-black text-slate-500 uppercase">Preço Mínimo</span>
                            <div className="flex gap-1 h-8">
                                <Input 
                                    className="bg-slate-950 border-white/10 text-[11px] font-black text-emerald-400 h-full w-full focus:border-emerald-500/50"
                                    placeholder="0,00"
                                    value={localMinPrice}
                                    onChange={(e) => setLocalMinPrice(e.target.value)}
                                    onBlur={() => onSave({ ...strategy, minPrice: parseFloat(localMinPrice.replace(',', '.')) || 0 })}
                                />
                                <Button size="icon" className="h-full w-8 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white" onClick={() => onSave({ ...strategy, minPrice: parseFloat(localMinPrice.replace(',', '.')) || 0 })}>
                                    <Check className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function StrategyModal({ item, initialStrategy, onSave, isBulk = false }: { item: BiddingItem, initialStrategy: ItemStrategy, onSave: (s: ItemStrategy) => void, isBulk?: boolean }) {
    const [strategy, setStrategy] = useState<ItemStrategy>(initialStrategy);

    return (
        <Dialog>
            <DialogTrigger asChild>
                {isBulk ? (
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-[10px] font-black bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/40"
                    >
                        CONFIGURAR LOTE
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon" className="rounded-xl hover:bg-white/10 transition-colors h-11 w-11 border border-white/5">
                        <Settings2 className="w-5 h-5 text-slate-400" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-900 border-white/10 text-slate-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-2xl font-black">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <Shield className="w-6 h-6 text-emerald-500" />
                        </div>
                        {isBulk ? 'ESTRATÉGIA EM MASSA' : `ITEM ${item.itemId}`}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-6">
                    <div className="space-y-3">
                        <Label className="text-slate-400 text-xs font-bold uppercase tracking-widest">Modo de Disputa</Label>
                        <Select value={strategy.mode} onValueChange={(v: any) => setStrategy({...strategy, mode: v})}>
                            <SelectTrigger className="bg-slate-950/50 border-white/10 h-12 text-sm font-bold">
                                <SelectValue />
                            </SelectTrigger>
                             <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-slate-100">
                                <SelectItem value="follower" className="text-sm font-bold">Seguidor (Reação Imediata)</SelectItem>
                                <SelectItem value="sniper" className="text-sm font-bold">Sniper (Segundo Final)</SelectItem>
                                <SelectItem value="shadow" className="text-sm font-bold">Modo Sombra (Manter 2º)</SelectItem>
                                <SelectItem value="cover" className="text-sm font-bold">Cobertura (Sempre Topo)</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5">
                            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                {strategy.mode === 'follower' && "⚡ Reage instantaneamente a cada lance baixado por concorrentes."}
                                {strategy.mode === 'sniper' && "🎯 Aguardará o encerramento iminente para dar o lance único."}
                                {strategy.mode === 'shadow' && "👤 Mantém-se colado no 1º lugar, forçando-o a baixar o preço."}
                                {strategy.mode === 'cover' && "🛡️ Garantirá que seu lance seja o melhor até o preço mínimo."}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <Label className="text-slate-400 text-xs font-bold uppercase tracking-widest">Preço Reserva</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-600 text-xs">R$</span>
                                <Input 
                                    type="number" 
                                    value={strategy.minPrice} 
                                    onChange={e => setStrategy({...strategy, minPrice: parseFloat(e.target.value)})}
                                    className="bg-slate-950 border-white/10 h-11 pl-8 font-black text-emerald-400"
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-slate-400 text-xs font-bold uppercase tracking-widest">Decremento</Label>
                            <Input 
                                type="number" 
                                value={strategy.decrementValue} 
                                onChange={e => setStrategy({...strategy, decrementValue: parseFloat(e.target.value)})}
                                className="bg-slate-950 border-white/10 h-11 font-mono text-slate-100"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-slate-400 text-xs font-bold uppercase tracking-widest">Tipo</Label>
                        <Select value={strategy.decrementType} onValueChange={(v: any) => setStrategy({...strategy, decrementType: v})}>
                            <SelectTrigger className="bg-slate-950/50 border-white/10 h-11 text-sm font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-slate-100">
                                <SelectItem value="fixed" className="text-sm font-bold">Valor Fixo (R$)</SelectItem>
                                <SelectItem value="percent" className="text-sm font-bold">Percentual (%)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter className="pt-2">
                    <Button onClick={() => onSave(strategy)} className="bg-emerald-600 hover:bg-emerald-500 w-full h-12 text-white font-black rounded-xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95">
                        SALVAR ESTRATÉGIA
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
