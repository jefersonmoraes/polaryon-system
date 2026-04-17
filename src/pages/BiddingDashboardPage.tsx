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
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
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
    meuValor?: number;
    valorEstimado?: number;
    uasgName?: string;
    ganhador: string;
    status: string;
    position: number;
    timerSeconds?: number;
    timeout?: string;
    desc?: string;
    descricao?: string; // Fallback
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
                        // viewMode logic removed, isListening handles the transition

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

            // 🛡️ MODO HÍBRIDO: Recepção da Telemetria Espiã
            if ((window as any).electronAPI.onBiddingHybridDump) {
                 (window as any).electronAPI.onBiddingHybridDump((pkg: any) => {
                      const payload = pkg.data || {};
                      if (pkg.action === 'TOKEN_GRABBED') {
                           console.log("%c[POLARYON HYBRID] TOKEN CAPTURADO: ", "color: yellow; font-size: 14px; font-weight: bold;", payload.token);
                           import('sonner').then(({ toast }) => toast.warning("Radar Híbrido: Conexão Oculta Estabelecida! 🤫"));
                      } else if (pkg.action === 'API_DUMP') {
                           console.log("%c[POLARYON HYBRID] API INTERCEPTADA (" + payload.url + "): ", "color: cyan; font-weight: bold;", payload.response);
                      } else if (pkg.action === 'HYBRID_API_RESULTS') {
                           console.log("%c[🔥 POLARYON HYBRID PULL DIRETO]: ", "color: #00ff00; font-weight: bold; background: #002200; padding: 2px 5px;", payload.items);
                      } else if (pkg.action === 'HYBRID_API_ERROR') {
                           console.log("%c[❌ POLARYON HYBRID ERROR]: ", "color: #ff0000; font-weight: bold;", payload);
                      }
                 });
            }

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
            // MERGE LOGIC v3.0: Prioritiza dados visuais e preserva 'meuValor'
            setItems(prevItems => {
                const incomingItems = data.items || [];
                if (prevItems.length === 0) return incomingItems;

                return incomingItems.map((newItem: any) => {
                    const existingItem = prevItems.find(p => p.itemId === newItem.itemId);
                    if (!existingItem) return newItem;

                    // Se o dado for da API Pública e não tiver meuValor, preserva o último conhecido
                    const meuValor = (newItem.isVisual || newItem.meuValor > 0) 
                        ? newItem.meuValor 
                        : (existingItem.meuValor || 0);

                    return { 
                        ...existingItem, 
                        ...newItem, 
                        meuValor,
                        // Preserva descrição se a nova for vazia
                        descricao: newItem.descricao || existingItem.descricao
                    };
                });
            });

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

        // 🔄 POLLING FALLBACK: Se o socket falhar ou atrasar, buscamos manualmente a cada 45s
        const fallbackInterval = setInterval(async () => {
            if (isListening && sessionId && !isLocalRunning) {
                try {
                    console.log("[POLARYON] Executando Polling Fallback...");
                    const res = await api.get(`/bidding/sessions/${sessionId}/items`);
                    if (res.data.success) {
                        setItems(res.data.items);
                        setLastUpdate(new Date().toLocaleTimeString() + " (REST)");
                    }
                } catch (e) {
                    console.error("Fallback polling failed", e);
                }
            }
        }, 45000);

        return () => {
            socketService.off('biddingUpdate', handleUpdate);
            socketService.off('biddingChat', handleChat);
            socketService.off('bidding_alert', handleAlert);
            clearInterval(fallbackInterval);
        };
    }, [socketService, sessionId, isListening, isLocalRunning]);

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
                        <h1 className="text-4xl font-black italic tracking-tighter bg-gradient-to-r from-emerald-400 via-cyan-500 to-indigo-500 bg-clip-text text-transparent uppercase flex items-center gap-3">
                            <Zap className="w-8 h-8 text-emerald-400 fill-current" />
                            TERMINAL ELITE
                        </h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1 italic flex items-center gap-2">
                             Visual Automation Engine <span className="w-1 h-1 bg-slate-700 rounded-full"></span> v3.0 Tactical
                        </p>
                    </div>

                    <div className="h-10 w-[1px] bg-white/10 hidden md:block"></div>

                    <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Alvos Ativos</span>
                            <span className="text-xl font-black text-slate-100">{allItems.length}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Vencendo</span>
                            <span className="text-xl font-black text-emerald-500">{items.filter(i => i.ganhador === 'Você').length}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Economia Total</span>
                            <span className="text-xl font-black text-cyan-400">R$ {items.reduce((acc, i) => acc + (i.ganhador === 'Você' ? (i.valorEstimado || 0) - i.valorAtual : 0), 0).toFixed(2)}</span>
                        </div>
                    </div>

                    {isListening ? (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-6 px-4 py-2 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                            <div className="flex flex-col">
                                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Sincronicidade</span>
                                <span className="text-xs font-mono text-cyan-400 flex items-center gap-1">
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> 100%
                                </span>
                            </div>
                            <div className="flex flex-col px-4 border-l border-white/5">
                                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Operação</span>
                                <span className={`text-[10px] font-black ${simulationMode ? 'text-amber-500' : 'text-red-500 animate-pulse'}`}>
                                    {simulationMode ? 'SIMULADO' : 'REAL-MODE'}
                                </span>
                            </div>
                            
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="outline" size="sm" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 h-8 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all">
                                        <Settings2 className="w-3.5 h-3.5 mr-2" /> COMANDOS
                                    </Button>
                                </SheetTrigger>
                                <SheetContent className="bg-slate-950 border-white/10 text-white w-[400px]">
                                    <SheetHeader className="border-b border-white/5 pb-4 mb-4">
                                        <SheetTitle className="text-emerald-500 flex items-center gap-2">
                                            <Shield className="w-5 h-5" /> CENTRAL DE COMANDO
                                        </SheetTitle>
                                        <SheetDescription className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                                            Ajustes táticos em tempo real
                                        </SheetDescription>
                                    </SheetHeader>
                                    
                                    <div className="space-y-6 overflow-y-auto max-h-[85vh] pr-2 custom-scrollbar">
                                        {/* Copied Config Block */}
                                        <div className="space-y-4">
                                            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Navegação e Foco</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant="outline" onClick={() => focusBiddingWindow()} className="bg-slate-900 border-white/10 text-[10px] h-9 font-black">
                                                    <Target className="w-3 h-3 mr-2" /> FOCAR PORTAL
                                                </Button>
                                                <Button variant="outline" onClick={() => navigateToRoom()} className="bg-slate-900 border-white/10 text-[10px] h-9 font-black">
                                                    <RefreshCw className="w-3 h-3 mr-2" /> IR P/ SALA
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                                                Mudar Modo de Voo
                                            </Label>
                                            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-black text-slate-100 uppercase">MODO REAL</p>
                                                    <p className="text-[9px] text-slate-500 font-bold uppercase italic">Cuidado: Envia lances ao Portal</p>
                                                </div>
                                                <Switch 
                                                    checked={!simulationMode} 
                                                    onCheckedChange={(val) => {
                                                        if (val) {
                                                            setShowRealModeWarning(true);
                                                        } else {
                                                            toggleSimulation(true);
                                                        }
                                                    }}
                                                    className="data-[state=checked]:bg-red-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Botão Global de Abortar */}
                                        <Button onClick={() => stopRadar()} variant="destructive" className="w-full font-black h-12 shadow-red-900/40 shadow-xl transition-all hover:scale-[1.02] uppercase tracking-widest text-xs mt-8">
                                            <Square className="w-4 h-4 mr-2 fill-current"/> ABORTAR MISSÃO TÁTICA
                                        </Button>

                                        {/* Logs Flutuantes */}
                                        <div className="mt-8">
                                            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                                                <Zap className="w-3 h-3 text-amber-500" /> Histórico de Lances
                                            </Label>
                                            <div className="space-y-2">
                                                {actionLogs.slice(0, 5).map((log, idx) => (
                                                    <div key={idx} className="p-2.5 bg-slate-900/50 rounded-xl border border-white/5 flex items-center justify-between">
                                                        <span className="text-[9px] font-black text-slate-400">ITEM {log.itemId}</span>
                                                        <span className="text-[10px] font-black text-emerald-400">R$ {log.value.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                         <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
                            <Button 
                                variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                                onClick={() => setViewMode('grid')}
                                className="h-9 px-4 text-[10px] font-black uppercase tracking-widest rounded-lg"
                            >
                                SELECIONAR PREGÃO
                            </Button>
                        </div>
                    </div>
                )}
                         {isListening ? (
                <div className="space-y-6 max-w-6xl mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* CHAT MONITOR FLOATING BAR */}
                    {chatMessages.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl flex items-center justify-between gap-4 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-amber-500/70 uppercase tracking-widest">Alerta do Pregoeiro</span>
                                    <p className="text-[11px] font-medium text-slate-200 truncate max-w-2xl leading-tight italic">
                                        "{chatMessages[chatMessages.length - 1].texto}"
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-[9px] font-black text-amber-500 hover:bg-amber-500/20 uppercase tracking-tighter">
                                Ver Todo Chat
                            </Button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                        {items.length === 0 ? (
                            <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl bg-slate-950/20">
                                <Target className="w-16 h-16 text-slate-800 animate-pulse mb-4" />
                                <h3 className="text-slate-500 font-black text-lg uppercase tracking-tighter">Injetando Sensores...</h3>
                                <p className="text-slate-700 text-[10px] mt-2 font-bold uppercase tracking-widest">O robô está sintonizando com os dados visuais do governo.</p>
                            </div>
                        ) : (
                            items.map(item => (
                                <CombatStreamCard 
                                    key={`${sessionId}-${item.itemId}`} 
                                    item={item} 
                                    sessionId={sessionId}
                                    strategy={itemStrategies[item.itemId] || { mode: 'follower', minPrice: 0 }}
                                    onSave={(s) => saveStrategy(item.itemId, s, sessionId)}
                                />
                            ))
                        )}
                    </div>
                </div>
            ) : (
                /* ========================================================================
                   LISTA DE SALAS (HOME / STANDBY)
                   ======================================================================== */
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
                            }}
                            className="group cursor-pointer shadow-xl border-none bg-slate-900/40 backdrop-blur-xl ring-1 ring-white/10 transition-all hover:scale-[1.02] hover:ring-emerald-500/50"
                        >
                            <div className={`h-1 w-full ${s.items.some(i => i.ganhador === 'Você') ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                            <CardHeader className="p-4 pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <CardTitle className="text-lg font-black tracking-tighter text-slate-100 italic">UASG {s.uasg}</CardTitle>
                                        <CardDescription className="text-[10px] font-bold uppercase text-slate-500 mt-1">Pregão {s.numero}</CardDescription>
                                    </div>
                                    <div className="px-2 py-0.5 rounded-full bg-slate-950/50 border border-white/5 text-[9px] font-black text-slate-400">
                                        {s.items.length} ITENS
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-2">
                                <div className="flex justify-between items-center text-[9px] font-bold text-slate-600 uppercase">
                                    <span>Sync: {s.lastUpdate}</span>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${s.isAuthenticated ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                                        <span>{s.isAuthenticated ? 'LOGADO' : 'AGUARDANDO'}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    
                    <Card 
                        onClick={() => {
                            setUasg('');
                            setNumeroPregao('');
                            setSessionId('');
                        }}
                        className="group cursor-pointer shadow-xl border-none bg-emerald-500/5 backdrop-blur-xl ring-1 ring-emerald-500/10 transition-all hover:scale-[1.02] border-2 border-dashed border-emerald-500/20"
                    >
                        <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                            <PlusIcon className="w-10 h-10 text-emerald-500 mb-3 opacity-60" />
                            <p className="font-black text-emerald-500 text-sm uppercase tracking-tighter italic">Nova Operação</p>
                        </CardContent>
                    </Card>

                    {/* CONFIGURAÇÃO RÁPIDA (Só aparece se nenhuma sala focada ou se quiser configurar nova) */}
                    <Card className="lg:col-span-3 shadow-2xl border-none bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 p-6 mt-4">
                         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                            <div className="space-y-2">
                                <Label className="text-slate-500 text-[10px] font-black uppercase tracking-widest">UASG / Órgão</Label>
                                <Input value={uasg} onChange={(e) => setUasg(e.target.value)} className="bg-slate-950 border-white/5 h-11 text-white font-black" placeholder="Ex: 927165" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Nº / Ano</Label>
                                <div className="flex gap-2">
                                    <Input value={numeroPregao} onChange={(e) => setNumeroPregao(e.target.value)} className="bg-slate-950 border-white/5 h-11 text-white font-black w-2/3" placeholder="Ex: 10" />
                                    <Input value={anoPregao} onChange={(e) => setAnoPregao(e.target.value)} className="bg-slate-950 border-white/5 h-11 text-white font-black w-1/3" placeholder="2026" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Modalidade</Label>
                                <Select value={modality} onValueChange={setModality}>
                                    <SelectTrigger className="bg-slate-950 border-white/5 h-11 text-white font-black">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                                        <SelectItem value="14">Dispensa Eletrônica (14.133)</SelectItem>
                                        <SelectItem value="06">Dispensa (Antiga)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={() => startRadar()} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black h-11 uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                                <Play className="w-4 h-4 mr-2 fill-current" /> Iniciar Infiltração
                            </Button>
                         </div>
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
function CombatStreamCard({ item, sessionId, strategy, onSave }: { item: BiddingItem, sessionId: string, strategy: ItemStrategy, onSave: (s: ItemStrategy) => void }) {
    const isWinning = item.ganhador === 'Você' || item.position === 1;
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
                                Item {item.itemId} {item.uasgName ? `• UASG ${item.uasgName}` : ''}
                            </span>
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-black italic tracking-tight w-fit ${isWinning ? 'bg-emerald-500 text-white' : 'bg-red-400 text-white animate-pulse'}`}>
                                {isWinning ? <Trophy className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                {isWinning ? 'VENCENDO' : `PERDENDO (${item.position || '?'}º)`}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold truncate mt-1">{item.desc || item.descricao}</span>
                        </div>
                    </div>

                    {/* LANCE E VALOR */}
                    <div className="col-span-4 flex flex-col items-center justify-center border-l border-r border-white/10 px-4">
                        <span className="text-[10px] text-slate-500 font-black uppercase mb-1">Meu Lance</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-slate-400 text-xs font-bold leading-none">R$</span>
                            <span className={`text-2xl font-black italic tracking-tighter leading-none ${isWinning ? 'text-emerald-400' : 'text-red-400'}`}>
                                {item.meuValor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '---'}
                            </span>
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold mt-1 uppercase">
                            Melhor Geral: <span className="text-white">R$ {item.valorAtual?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {/* TIMER DE COMBATE */}
                    <div className="col-span-2 flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 font-black uppercase mb-1">Tempo</span>
                        <div className={`text-xl font-mono font-black tracking-tighter tabular-nums ${item.timerSeconds && item.timerSeconds < 30 ? 'text-orange-500 animate-pulse' : 'text-white'}`}>
                            {item.timeout || '--:--'}
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
