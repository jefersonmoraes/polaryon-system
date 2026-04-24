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

    // [MODO SIGA v3.2] VIEW STATE
    const [viewMode, setViewMode] = useState<'card' | 'grid'>('grid');
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [modalityTab, setModalityTab] = useState<'PREGAO' | 'DISPENSA'>('DISPENSA');

    const quickBid = async (itemId: string, value: number, sid?: string) => {
        const targetSid = sid || sessionId;
        if (!targetSid) return;
        try {
            toast.info(`Enviando lance R$ ${value.toFixed(2)}...`);
            await api.post(`/bidding/sessions/${targetSid}/items/${itemId}/bid`, { value });
        } catch (error) {
            console.error("Quick bid failed:", error);
            toast.error("Falha ao enviar lance rápido.");
        }
    };

    const dummyCredentialId = 'simulated-credential-id';

    const openPortalLogin = async () => {
        if (isDesktop && (window as any).electronAPI) {
            try {
                // 1. Criar uma sessão "Autodiscovery" ou usar uma padrão
                const res = await api.post('/bidding/sessions', {
                    credentialId: dummyCredentialId,
                    portal: 'compras_gov',
                    uasg: 'LOGIN',
                    numeroPregao: 'PORTAL',
                    anoPregao: new Date().getFullYear().toString()
                });

                if (res.data.success) {
                    const session = res.data.session;
                    setSessionId(session.id);
                    
                    // 2. Abrir o portal diretamente na tela de login
                    (window as any).electronAPI.startVisualBidding({
                        sessionId: session.id,
                        uasg: 'LOGIN',
                        numero: 'PORTAL',
                        ano: new Date().getFullYear().toString(),
                        vault: {
                            simulationMode,
                            itemsConfig: itemStrategies
                        },
                        modality: 'LOGIN_FLOW' // Sinaliza ao runner que é um fluxo de login
                    });
                    
                    setIsLocalRunning(true);
                    setIsListening(true);
                    toast.success("Abrindo Portal Compras.gov.br... Utilize seu Certificado Digital. 🔐");
                }
            } catch (error) {
                console.error("Failed to open portal:", error);
                toast.error("Erro ao abrir o portal de compras.");
            }
        } else {
            toast.warning("O login via Certificado Digital requer o Polaryon Desktop.");
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

            // 🔍 [SIGA AUTO-DISCOVERY] Detecção de Entrada em Sala
            if ((window as any).electronAPI.onBiddingDetectedRoom) {
                (window as any).electronAPI.onBiddingDetectedRoom((data: any) => {
                    const { url } = data;
                    console.log("[POLARYON] Sala detectada via navegação manual:", url);
                    
                    // Extrair dados da URL (Padrão: compra=UASG06NUMEROANO)
                    const match = url.match(/compra=(\d{6})06(\d{5})(\d{4})/);
                    if (match) {
                        const [, detectedUasg, detectedNum, detectedAno] = match;
                        setUasg(detectedUasg);
                        setNumeroPregao(detectedNum);
                        setAnoPregao(detectedAno);
                        
                        toast.success(`Sala Detectada: UASG ${detectedUasg} - Pregão ${detectedNum}. Sincronizando... ⚡`);
                    }
                });
            }

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
        <div className="min-h-screen bg-[#020817] text-white font-['JetBrains_Mono'] overflow-x-hidden">
            {/* [SIGA CLONE] HEADER TÁTICO CENTRALIZADO */}
            <div className="w-full py-10 px-6 flex flex-col items-center justify-center border-b border-white/5 bg-gradient-to-b from-[#020817] to-[#030e25] relative">
                {/* Status de Conexão Flutuante (v3.2) */}
                <div className="absolute top-6 right-8 flex items-center gap-4 bg-white/5 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-white/20'}`} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                            {isListening ? 'Sistema Operacional' : 'Standby'}
                        </span>
                    </div>
                    {isListening && (
                        <button onClick={stopRadar} className="text-red-400 hover:text-red-300 transition-colors">
                            <XCircle className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <h1 className="text-4xl font-['Anton'] tracking-wider mb-2 text-white/90">DISPUTAS COMPRASNET</h1>
                <p className="text-white/40 text-[10px] mb-8 uppercase tracking-[0.3em]">Envie seus lances nos seus pregões e dispensas eletrônicas</p>
                
                {/* [SIGA CLONE] SELETOR DE MODALIDADE */}
                <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 backdrop-blur-sm">
                    <button 
                        onClick={() => setModalityTab('PREGAO')}
                        className={`px-10 py-2.5 rounded-md text-[10px] font-black uppercase transition-all duration-300 tracking-widest ${modalityTab === 'PREGAO' ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-white/40 hover:text-white'}`}
                    >
                        Pregões eletrônicos
                    </button>
                    <button 
                        onClick={() => setModalityTab('DISPENSA')}
                        className={`px-10 py-2.5 rounded-md text-[10px] font-black uppercase transition-all duration-300 tracking-widest ${modalityTab === 'DISPENSA' ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-white/40 hover:text-white'}`}
                    >
                        Dispensas eletrônicas
                    </button>
                </div>
            </div>

            <main className="container mx-auto px-4 py-8 max-w-7xl">
                {!isListening ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                        {/* CARD DE ACESSO "MÁQUINA DE LANCES" */}
                        <div className="bg-[#030e25] border border-white/10 p-12 rounded-[2.5rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] text-center max-w-lg w-full backdrop-blur-2xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                            
                            <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/10 transform rotate-12 group-hover:rotate-0 transition-transform duration-500">
                                <Zap className="w-12 h-12 text-white/80 fill-current" />
                            </div>
                            
                            <h2 className="text-3xl font-black tracking-tighter mb-4 text-white uppercase">MÁQUINA DE LANCES</h2>
                            <p className="text-white/40 text-xs mb-10 leading-relaxed px-4 font-bold uppercase tracking-widest">
                                Inicie a automação visual. O robô abrirá o navegador oficial para você autenticar com seu Certificado Digital.
                            </p>
                            
                            <button
                                onClick={openPortalLogin}
                                className="w-full bg-white hover:bg-slate-100 text-black font-black py-5 rounded-2xl flex items-center justify-center space-x-4 transition-all transform hover:scale-[1.02] active:scale-95 shadow-2xl shadow-white/10 group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                <Shield className="w-6 h-6" />
                                <span className="text-lg uppercase tracking-tight">LOGIN COMPRAS.GOV.BR</span>
                            </button>

                            <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-center gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Protocolo SIGA</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Latência Zero</span>
                                </div>
                            </div>
                        </div>

                        {/* LISTA DE SALAS ATIVAS NO CACHE (SIGA STYLE) */}
                        {Object.keys(sessions).length > 0 && (
                            <div className="w-full max-w-4xl space-y-6">
                                <div className="flex items-center gap-4 px-4">
                                    <div className="h-[1px] flex-1 bg-white/5" />
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Sessões em Cache</span>
                                    <div className="h-[1px] flex-1 bg-white/5" />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(sessions).map(([sid, s]) => (
                                        <div 
                                            key={sid} 
                                            onClick={() => {
                                                setSessionId(sid);
                                                setItems(s.items);
                                                setIsListening(true);
                                            }}
                                            className="bg-white/5 hover:bg-white/10 border border-white/10 p-5 rounded-2xl cursor-pointer transition-all flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center border border-white/5 text-xs font-black text-white/40">
                                                    {s.items.length}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-white/80 group-hover:text-white uppercase tracking-tighter">UASG {s.uasg}</h4>
                                                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Sessão {s.numero} • {s.lastUpdate}</p>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Target className="w-4 h-4 text-emerald-400" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 pb-20">
                        <div className={`grid ${viewMode === 'grid' ? 'grid-cols-12' : 'grid-cols-1'} gap-6`}>
                            {/* LISTA DE ITENS */}
                            <div className={`${viewMode === 'grid' && isChatOpen ? 'col-span-9' : 'col-span-12'} space-y-4`}>
                                {items.length === 0 ? (
                                    <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl bg-slate-950/20">
                                        <Target className="w-16 h-16 text-slate-800 animate-pulse mb-6" />
                                        <h3 className="text-slate-500 font-black text-lg uppercase tracking-tighter italic">Sincronizando Sensores...</h3>
                                        <p className="text-slate-700 text-[10px] mt-2 font-black uppercase tracking-widest">O robô está sintonizando com os dados visuais do governo.</p>
                                    </div>
                                ) : (
                                    <BiddingGridView 
                                        items={allItems} 
                                        sessionId={sessionId || ''}
                                        strategies={itemStrategies}
                                        onSaveStrategy={saveStrategy}
                                        onQuickBid={quickBid}
                                    />
                                )}
                            </div>

                            {/* CHAT MONITOR PERSISTENTE (GRID MODE) */}
                            {viewMode === 'grid' && isChatOpen && (
                                <div className="col-span-3 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl flex flex-col h-[75vh] sticky top-24 overflow-hidden">
                                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                        <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                                            <Zap className="w-3 h-3 fill-current" /> Monitor de Chat
                                        </h3>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsChatOpen(false)}>
                                            <XCircle className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                        {chatMessages.length === 0 ? (
                                            <p className="text-[10px] text-slate-600 italic text-center py-10">Nenhuma mensagem interceptada.</p>
                                        ) : (
                                            chatMessages.map((msg, idx) => (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[8px] font-black text-slate-500">{msg.data || msg.time}</span>
                                                        <span className="text-[8px] font-black text-amber-600 uppercase">{msg.origem || 'PORTAL'}</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-300 bg-black/30 p-2 rounded-lg border border-white/5">
                                                        {msg.texto || msg.text}
                                                    </p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>


            <AlertDialog open={showRealModeWarning} onOpenChange={setShowRealModeWarning}>
                <AlertDialogContent className="bg-slate-950 border-white/10 text-slate-100 p-8">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-4 text-3xl font-black italic tracking-tighter text-red-500">
                            <ShieldAlert className="w-8 h-8 animate-pulse" /> MODO REAL ATIVADO
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400 text-sm leading-relaxed mt-4">
                            Ao desativar o modo simulação, o robô irá realizar lances <span className="text-white font-bold underline">REAIS</span> no portal Gov.br usando seu Certificado Digital.
                            <br /><br />
                            Estes lances têm <span className="text-red-400 font-bold uppercase">validade jurídica e financeira</span>. O usuário assume total responsabilidade por cada disparo realizado durante esta sessão.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-10 gap-4">
                        <AlertDialogCancel className="bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700 h-12 font-black">CANCELAR OPERAÇÃO</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={() => toggleSimulation(false)}
                            className="bg-red-600 hover:bg-red-500 text-white font-black h-12 px-8 shadow-2xl shadow-red-900/50"
                        >
                            ENTENDI, ATIVAR DISPARO REAL
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// v2.0 - COMPONENTE DE ELITE PARA FLUXO DE COMBATE
// [MODO SIGA v3.2] GRID VIEW COMPONENT - HIGH DENSITY MONITORING
function BiddingGridView({ items, sessionId, strategies, onSaveStrategy, onQuickBid }: { 
    items: any[], 
    sessionId: string, 
    strategies: Record<string, ItemStrategy>,
    onSaveStrategy: (id: string, s: ItemStrategy, sid: string) => void,
    onQuickBid: (id: string, val: number, sid: string) => void
}) {
    return (
        <div className="bg-slate-950/50 rounded-3xl border border-white/10 overflow-hidden backdrop-blur-xl shadow-2xl">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-900/80 border-b border-white/10">
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Item / UASG</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status / Posição</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Melhor Valor</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Meu Lance</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Timer</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estratégia / Mínimo</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Ações Rápidas</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {items.map(item => {
                        const isWinning = item.ganhador === 'Você' || item.position === 1;
                        const strategy = strategies[item.itemId] || { mode: 'manual', minPrice: 0, decrementValue: 0.01, decrementType: 'fixed' };
                        const isImminent = item.timerSeconds && item.timerSeconds < 60;
                        const sid = item.sid || sessionId;

                        return (
                            <tr key={`${sid}-${item.itemId}`} className={`group transition-colors hover:bg-white/[0.02] ${isWinning ? 'bg-emerald-500/[0.02]' : 'bg-red-500/[0.02]'}`}>
                                <td className="px-4 py-2 relative">
                                    <div className={`absolute left-0 top-0 w-1 h-full ${isWinning ? 'bg-emerald-500' : 'bg-red-500'} ${isImminent ? 'animate-pulse' : ''}`} />
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black text-slate-200">ITEM {item.itemId}</span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">UASG {item.uasgName || '---'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${isWinning ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                            {isWinning ? 'Vencendo' : `${item.position || '?'}º Lugar`}
                                        </div>
                                        {isImminent && (
                                            <div className="bg-orange-500 text-white text-[8px] font-black px-1.5 rounded animate-bounce">IMINÊNCIA</div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-2">
                                    <span className="text-[11px] font-mono font-bold text-white">
                                        R$ {item.valorAtual?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <span className={`text-[13px] font-mono font-black italic ${isWinning ? 'text-emerald-400' : 'text-red-400'}`}>
                                        R$ {item.meuValor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '---'}
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <span className={`text-[11px] font-mono font-bold ${isImminent ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`}>
                                        {item.timeout || '--:--'}
                                    </span>
                                </td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    checked={strategy.mode === 'follower'}
                                                    onChange={(e) => onSaveStrategy(item.itemId, { ...strategy, mode: e.target.checked ? 'follower' : 'manual' }, sid)}
                                                    className="w-3.5 h-3.5 rounded border-white/20 bg-slate-900 accent-emerald-500"
                                                />
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Auto</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    checked={strategy.mode === 'sniper'}
                                                    onChange={(e) => onSaveStrategy(item.itemId, { ...strategy, mode: e.target.checked ? 'sniper' : 'manual' }, sid)}
                                                    className="w-3.5 h-3.5 rounded border-white/20 bg-slate-900 accent-orange-500"
                                                />
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sniper</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[8px] font-black text-slate-600 uppercase">Mínimo</span>
                                            <input 
                                                type="text"
                                                className="bg-black/40 border border-white/5 rounded px-2 py-0.5 text-[10px] font-black text-emerald-500 w-20 focus:border-emerald-500/50 outline-none"
                                                defaultValue={strategy.minPrice}
                                                onBlur={(e) => onSaveStrategy(item.itemId, { ...strategy, minPrice: parseFloat(e.target.value.replace(',', '.')) || 0 }, sid)}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => onQuickBid(item.itemId, (item.valorAtual || 0) - 0.01, sid)}
                                            className="h-7 px-2 text-[9px] font-black bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                                        >
                                            -0,01
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => onQuickBid(item.itemId, (item.valorAtual || 0) - 1.00, sid)}
                                            className="h-7 px-2 text-[9px] font-black bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-white"
                                        >
                                            -1,00
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => onQuickBid(item.itemId, (item.valorAtual || 0) - 0.01, sid)}
                                            className="h-7 px-2 text-[9px] font-black bg-slate-800 border-white/10 text-white hover:bg-white hover:text-black"
                                        >
                                            COBRIR
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function CombatStreamCard({ item, sessionId, strategy, onSave }: { item: BiddingItem, sessionId: string, strategy: ItemStrategy, onSave: (s: ItemStrategy) => void }) {
    const isWinning = item.ganhador === 'Você' || item.position === 1;
    const [localMinPrice, setLocalMinPrice] = useState(strategy?.minPrice?.toString() || "0");

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
