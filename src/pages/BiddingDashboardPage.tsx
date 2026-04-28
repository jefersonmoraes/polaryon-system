import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, Activity, RefreshCw, Play, Square, Settings2, Target, Zap, Shield, Key, History, AlertTriangle, CheckCircle2, Plus as PlusIcon, Check, Trophy, ChevronDown, ChevronUp, Clock, XCircle, LogOut, Search, StopCircle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

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
    const [networkTraffic, setNetworkTraffic] = useState<any[]>([]);
    const [hybridRooms, setHybridRooms] = useState<string[]>([]);
    const [apiStatus, setApiStatus] = useState<string>('OFFLINE');

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
                    
                    (window as any).electronAPI.startVisualBidding({
                        sessionId: session.id,
                        uasg: 'LOGIN',
                        numero: 'PORTAL',
                        ano: new Date().getFullYear().toString(),
                        vault: {
                            simulationMode,
                            itemsConfig: itemStrategies
                        },
                        modality: 'LOGIN_FLOW'
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
        if (!sessions) return list;

        Object.entries(sessions).forEach(([sid, session]) => {
            if (!session) return;
            const sessionItems = Array.isArray(session.items) ? session.items : [];
            sessionItems.forEach(item => {
                if (!item) return;
                list.push({ ...item, sid, uasgName: session.uasg || '---' });
            });
        });

        // Ordenação inteligente: Perdedores e Urgentes primeiro
        return [...list].sort((a, b) => {
            const aIsWinning = a.ganhador === 'Você' || a.position === 1;
            const bIsWinning = b.ganhador === 'Você' || b.position === 1;
            
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

    useEffect(() => {
        if (credentials.length > 0 && !selectedCredentialId) {
            setSelectedCredentialId(credentials[0].id);
        }
    }, [credentials, selectedCredentialId]);

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
            }
        }
    }, [searchParams]);

    // ELECTRON LOCAL RUNNER LISTENER
    useEffect(() => {
        if (isDesktop && (window as any).electronAPI) {
            const handleUpdate = (data: any) => {
                const { sessionId: sid, items: newItems, timestamp, turbo: isTurbo } = data;
                
                if (sid === sessionId) {
                    setItems(newItems || []);
                    setLastUpdate(timestamp);
                    if (isTurbo !== undefined) setTurbo(isTurbo);
                }

                setSessions(prev => ({
                    ...prev,
                    [sid]: {
                        ...(prev[sid] || {}),
                        items: Array.isArray(newItems) ? newItems : [],
                        lastUpdate: timestamp
                    }
                }));
            };
            
            const handleChat = (data: any) => {
                const { sessionId: sid, messages } = data;
                if (sid === sessionId) {
                    setChatMessages(messages || []);
                }
                setSessions(prev => ({
                    ...prev,
                    [sid]: {
                        ...(prev[sid] || {}),
                        chatMessages: Array.isArray(messages) ? messages : []
                    }
                }));
            };
            
            (window as any).electronAPI.onBiddingUpdate(handleUpdate);
            (window as any).electronAPI.onBiddingChat(handleChat);

            if ((window as any).electronAPI.onBiddingNetworkTraffic) {
                (window as any).electronAPI.onBiddingNetworkTraffic((data: any) => {
                    setNetworkTraffic(prev => [data, ...(prev || [])].slice(0, 50));
                });
            }

            if ((window as any).electronAPI.onBiddingDetectedRoom) {
                (window as any).electronAPI.onBiddingDetectedRoom((data: any) => {
                    const { url } = data;
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

            if ((window as any).electronAPI.onBiddingLoginFinished) {
                (window as any).electronAPI.onBiddingLoginFinished(() => {
                    toast.success("Login confirmado! Ocultando janela e iniciando radar silencioso... 🛡️");
                    setIsListening(true);
                });
            }

            if ((window as any).electronAPI.onBiddingHybridDump) {
                (window as any).electronAPI.onBiddingHybridDump((pkg: any) => {
                    const payload = pkg.data || {};
                    if (pkg.action === 'TOKEN_GRABBED') {
                         console.log("%c[POLARYON HYBRID] TOKEN CAPTURADO: ", "color: yellow; font-size: 14px; font-weight: bold;", payload.token);
                         import('sonner').then(({ toast }) => toast.warning("Radar Híbrido: Conexão Oculta Estabelecida! 🤫"));
                    } else if (pkg.action === 'HYBRID_API_RESULTS') {
                         const hybridItems = Array.isArray(payload.items) ? payload.items : [];
                         if (hybridItems.length > 0) {
                             const newSessions: Record<string, any> = {};
                             hybridItems.forEach((item: any) => {
                                 if (!item) return;
                                 const uasgCode = item.polaryon_purchaseId || item.uasg || item.codigoUasg || 'SISTEMA';
                                 const num = item.numeroCompra || item.numero || '0';
                                 const ano = item.polaryon_year || item.anoCompra || item.ano || '2026';
                                 const sid = `HYBRID_${uasgCode}_${num}_${ano}`;
                                 
                                 if (!newSessions[sid]) {
                                     newSessions[sid] = { 
                                          uasg: uasgCode, 
                                          numero: num, 
                                          items: [], 
                                          chatMessages: [], 
                                          lastUpdate: new Date().toLocaleTimeString(), 
                                          isAuthenticated: true, 
                                          simulationMode: true, 
                                          isHybrid: true 
                                     };
                                 }

                                 if (!sessionId) {
                                     setSessionId(sid);
                                     setIsListening(true);
                                 }

                                 const melhorGeral = (item.melhorValorGeral ? (item.melhorValorGeral.valorInformado ?? item.melhorValorGeral.valorCalculado) : 0) || 0;
                                 const melhorMeu = (item.melhorValorFornecedor ? (item.melhorValorFornecedor.valorInformado ?? item.melhorValorFornecedor.valorCalculado) : 0) || 0;
                                 const pos = String(item.posicaoParticipanteDisputa || '').trim().toUpperCase();
                                 const isWinner = pos === '1' || pos === '1º' || pos === 'V' || pos === 'VENCEDOR' || pos === '1°';
                                 
                                 newSessions[sid].items.push({
                                     itemId: item.identificador || (item.numero ? item.numero.toString() : '0'),
                                     valorAtual: melhorGeral, 
                                     meuValor: melhorMeu, 
                                     uasgName: uasgCode, 
                                     ganhador: isWinner ? 'Você' : 'Outro',
                                     status: item.situacao === '1' ? 'Disputa' : (item.situacao === '2' ? 'Iminência' : 'Encerrado'),
                                     position: parseInt(pos) || 0, 
                                     timerSeconds: item.segundosParaEncerramento || -1, 
                                     desc: item.descricao || `Item ${item.numero}`
                                 });
                             });
                             setSessions(prev => {
                                 const updated = { ...(prev || {}) };
                                 Object.entries(newSessions).forEach(([sid, session]) => {
                                     updated[sid] = { ...(updated[sid] || {}), ...session, chatMessages: updated[sid]?.chatMessages || [] };
                                 });
                                 return updated;
                             });
                         }
                    } else if (pkg.action === 'HYBRID_API_ERROR') {
                         console.log("%c[❌ POLARYON HYBRID ERROR]: ", "color: #ff0000; font-weight: bold;", payload);
                    }
                });
            }

            const restore = async () => {
                const activeSessions = await (window as any).electronAPI.getRestoredSessions();
                const sessionIds = Object.keys(activeSessions || {});
                
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
                                    setSessionId(id);
                                    setIsLocalRunning(true);
                                    setIsListening(true);
                                }
                            } catch (e) { console.error(e); }
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
            await api.patch(`/bidding/sessions/${sid}/items/${itemId}`, { ...strategy, simulationMode });
            setItemStrategies(prev => ({ ...prev, [itemId]: strategy }));
            if (isLocalRunning && (window as any).electronAPI) {
                (window as any).electronAPI.updateLocalBiddingConfig(sid, { itemsConfig: { ...itemStrategies, [itemId]: strategy } });
            }
        } catch (error) { console.error(error); }
    };

    const toggleSimulation = async (val: boolean) => {
        setSimulationMode(val);
        if (sessionId) {
            try {
                await api.patch(`/bidding/sessions/${sessionId}/items/__global__`, { simulationMode: val });
                if (isLocalRunning && (window as any).electronAPI) {
                    (window as any).electronAPI.updateLocalBiddingConfig(sessionId, { simulationMode: val });
                }
                toast.info(`Modo ${val ? 'SIMULADO' : 'REAL'} ativado.`);
            } catch (e) { console.error(e); }
        }
    };

    const startRadar = async (u: string, n: string, a: string) => {
        try {
            const res = await api.post('/bidding/sessions', { uasg: u, numeroPregao: n, anoPregao: a, portal: 'compras_gov', credentialId: selectedCredentialId || dummyCredentialId });
            if (res.data.success) {
                const sid = res.data.session.id;
                setSessionId(sid);
                setIsListening(true);
                if (isDesktop && (window as any).electronAPI) {
                    (window as any).electronAPI.startVisualBidding({ sessionId: sid, uasg: u, numero: n, ano: a, vault: { simulationMode, itemsConfig: itemStrategies } });
                    setIsLocalRunning(true);
                }
            }
        } catch (e) { console.error(e); }
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 font-sans overflow-x-hidden">
            <header className="w-full h-16 bg-black flex items-center justify-between px-8 shadow-xl sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-1.5 rounded-md flex items-center justify-center"><Zap className="w-5 h-5 text-black fill-current" /></div>
                    <h1 className="text-white font-black italic text-xl tracking-tighter">SIGA <span className="text-emerald-400">POLARYON</span></h1>
                </div>
                <div className="flex items-center gap-6">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-[10px] font-black text-white uppercase tracking-tight">{authUser?.name || 'OPERADOR TÁTICO'}</span>
                        <span className="text-[9px] font-bold text-slate-400">{authUser?.email || 'conexão.segura@polaryon.com'}</span>
                    </div>
                    <Button variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700 text-white font-black text-[10px] h-8 px-4" onClick={() => useAuthStore.getState().logout()}>Sair</Button>
                </div>
            </header>

            <div className="w-full bg-white border-b border-slate-200 py-6 flex flex-col items-center">
                <div className="container mx-auto px-6 flex justify-between items-center">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Terminal de Combate</h2>
                        <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-[9px] font-black bg-slate-100 text-slate-400 border-slate-200">Δ SYNC: {Math.abs(serverOffset)}ms</Badge>
                            <Badge className="text-[9px] font-black bg-emerald-500 text-white border-none">STATUS: OPERACIONAL</Badge>
                        </div>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
                        <button onClick={() => setModalityTab('PREGAO')} className={`px-8 py-2 rounded-full text-[10px] font-black uppercase transition-all duration-300 tracking-widest ${modalityTab === 'PREGAO' ? 'bg-black text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}>Pregões</button>
                        <button onClick={() => setModalityTab('DISPENSA')} className={`px-8 py-2 rounded-full text-[10px] font-black uppercase transition-all duration-300 tracking-widest ${modalityTab === 'DISPENSA' ? 'bg-black text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}>Dispensas</button>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Simulação</span>
                             <Switch checked={simulationMode} onCheckedChange={toggleSimulation} />
                        </div>
                        <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-slate-200" onClick={() => setIsChatOpen(!isChatOpen)}>
                            <Zap className={`w-5 h-5 ${isChatOpen ? 'text-emerald-500 fill-emerald-500' : 'text-slate-300'}`} />
                        </Button>
                    </div>
                </div>
            </div>

            {Object.keys(sessions).length > 0 && (
                <div className="w-full bg-slate-900 border-b border-white/5 py-2 px-6 flex items-center gap-3 overflow-x-auto no-scrollbar">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-2">Salas Ativas:</span>
                    {Object.entries(sessions).map(([sid, s]) => (
                        <button 
                            key={sid}
                            onClick={() => { setSessionId(sid); setItems(s.items || []); setIsListening(true); }}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-all whitespace-nowrap ${sessionId === sid ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                        >
                            <Activity className={`w-3 h-3 ${sessionId === sid ? 'text-white' : 'text-emerald-500'}`} />
                            <span className="text-[10px] font-black tracking-tight">UASG {s.uasg} | {(s.items || []).length} Itens</span>
                            {(s.items || []).some(it => (it.status || '').toLowerCase().includes('disputa')) && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                        </button>
                    ))}
                </div>
            )}

            <main className="container mx-auto px-4 py-8 max-w-[1800px]">
                {!isListening ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                        <div className="bg-white border border-slate-200 p-12 rounded-[2.5rem] shadow-2xl text-center max-w-lg w-full relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                            <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-slate-100 transform rotate-12 group-hover:rotate-0 transition-transform duration-500"><Zap className="w-12 h-12 text-emerald-500 fill-current" /></div>
                            <h2 className="text-3xl font-black tracking-tighter mb-4 text-slate-900 uppercase">MÁQUINA DE LANCES</h2>
                            <p className="text-slate-500 text-xs mb-10 leading-relaxed px-4 font-bold uppercase tracking-widest">Inicie a automação visual. O robô abrirá o navegador oficial para você autenticar com seu Certificado Digital.</p>
                            <button onClick={openPortalLogin} className="w-full bg-black hover:bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center space-x-4 transition-all shadow-xl"><Shield className="w-6 h-6 text-emerald-400" /><span className="text-lg uppercase tracking-tight">LOGIN COMPRAS.GOV.BR</span></button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-12 gap-8 animate-in fade-in duration-700">
                        <div className={`${isChatOpen ? 'col-span-9' : 'col-span-12'} space-y-6`}>
                            {/* --- MONITOR DE TRÁFEGO v3.5.10 (DIAGNÓSTICO) --- */}
            <div className="mt-8">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-slate-900 text-white hover:bg-black border-none gap-2 font-black text-[10px] uppercase tracking-tighter">
                            <Activity className="w-3 h-3" /> Monitor de Tráfego {networkTraffic.length > 0 && `(${networkTraffic.length})`}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[60vh] bg-slate-950 text-white border-slate-800">
                        <SheetHeader className="border-b border-slate-800 pb-4 mb-4">
                            <SheetTitle className="text-white font-black uppercase text-sm flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-500" /> Terminal de Diagnóstico Polaryon
                            </SheetTitle>
                            <SheetDescription className="text-slate-500 text-[10px] font-bold uppercase">
                                Visualização em tempo real das requisições à API do Serpro
                            </SheetDescription>
                        </SheetHeader>
                        <div className="overflow-auto h-full font-mono text-[10px] space-y-1 pb-20">
                            {networkTraffic.length === 0 ? (
                                <div className="text-center py-20 text-slate-700 font-bold uppercase tracking-widest">Aguardando tráfego de rede...</div>
                            ) : networkTraffic.map((req, idx) => (
                                <div key={idx} className="flex gap-4 border-b border-slate-900/50 py-1 hover:bg-white/5 transition-colors px-2">
                                    <span className="text-slate-600">[{new Date(req.timestamp).toLocaleTimeString()}]</span>
                                    <span className={`font-black ${req.statusCode === 200 ? 'text-emerald-500' : 'text-red-500'}`}>{req.statusCode}</span>
                                    <span className="text-slate-400">GET</span>
                                    <span className="text-slate-300 truncate flex-1">{req.url}</span>
                                </div>
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

             <div className="space-y-8 pb-12">
                {Object.entries(sessions || {}).map(([sid, session]: [string, any]) => (
                    <ProcessCard 
                        key={sid} 
                        sid={sid} 
                        session={session} 
                        items={groupedItems[sid] || []} 
                        onSaveStrategy={onSaveStrategy} 
                        onQuickBid={onQuickBid} 
                        onStopRadar={() => onStopRadar(sid)} 
                    />
                ))}
            </div>
                        </div>
                        {isChatOpen && (
                            <div className="col-span-3 space-y-6 sticky top-24 h-[calc(100vh-140px)] flex flex-col">
                                <Card className="bg-slate-900 border-none shadow-2xl rounded-2xl flex flex-col flex-1 overflow-hidden">
                                    <CardHeader className="bg-white/5 border-b border-white/5 py-3 px-5"><CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity className="w-3 h-3 text-emerald-500" /> Fluxo de Dados</CardTitle></CardHeader>
                                    <CardContent className="p-0 flex-1 overflow-y-auto font-mono text-[9px] p-2 space-y-1 custom-scrollbar">
                                        {(networkTraffic || []).length === 0 ? <div className="h-full flex items-center justify-center text-slate-600 italic">Capturando pacotes...</div> : networkTraffic.map((log, idx) => (
                                            <div key={idx} className="flex gap-2 border-b border-white/5 pb-1"><span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span><span className={log.statusCode >= 400 ? 'text-red-400' : 'text-emerald-400'}>{log.statusCode}</span><span className="truncate text-slate-300">GET {log.url.split('/').pop().split('?')[0]}</span></div>
                                        ))}
                                    </CardContent>
                                    <div className="p-3 bg-white/5 border-t border-white/5 flex justify-between text-[8px] font-black text-slate-500 uppercase"><span>Ping: {Math.abs(serverOffset)}ms</span><span className="text-emerald-500">SYNC: OK</span></div>
                                </Card>
                                <Card className="bg-white border-slate-200 shadow-xl rounded-2xl flex-1 flex flex-col overflow-hidden">
                                    <CardHeader className="py-3 px-5 border-b border-slate-100"><CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mensagens</CardTitle></CardHeader>
                                    <CardContent className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                        {(chatMessages || []).length === 0 ? <p className="text-[10px] text-slate-300 italic text-center py-10">Nenhuma mensagem.</p> : chatMessages.map((msg, idx) => (
                                            <div key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-100"><p className="text-[10px] text-slate-700">{msg.texto || msg.text}</p></div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                )}
            </main>

            <AlertDialog open={showRealModeWarning} onOpenChange={setShowRealModeWarning}>
                <AlertDialogContent className="bg-slate-950 border-white/10 text-slate-100 p-8">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-4 text-3xl font-black italic tracking-tighter text-red-500"><ShieldAlert className="w-8 h-8 animate-pulse" /> MODO REAL ATIVADO</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400 text-sm leading-relaxed mt-4">Ao desativar o modo simulação, o robô irá realizar lances REAIS no portal Gov.br usando seu Certificado Digital.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-10 gap-4">
                        <AlertDialogCancel className="bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700 h-12 font-black">CANCELAR</AlertDialogCancel>
                        <AlertDialogAction onClick={() => toggleSimulation(false)} className="bg-red-600 hover:bg-red-500 text-white font-black h-12 px-8 shadow-2xl shadow-red-900/50">ATIVAR DISPARO REAL</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function BiddingSigaView({ items, sessions, onSaveStrategy, onQuickBid, onStopRadar }: any) {
    const groupedItems = useMemo(() => {
        const groups: Record<string, any[]> = {};
        const safeItems = Array.isArray(items) ? items : [];
        safeItems.forEach(item => {
            if (!item.sid) return;
            if (!groups[item.sid]) groups[item.sid] = [];
            groups[item.sid].push(item);
        });
        return groups;
    }, [items]);

    return (
        <div className="space-y-8 pb-12">
            {Object.entries(sessions || {}).map(([sid, session]: [string, any]) => (
                <ProcessCard key={sid} sid={sid} session={session} items={groupedItems[sid] || []} onSaveStrategy={onSaveStrategy} onQuickBid={onQuickBid} onStopRadar={() => onStopRadar(sid)} />
            ))}
        </div>
    );
}

function ProcessCard({ sid, session, items, onSaveStrategy, onQuickBid, onStopRadar }: any) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [tab, setTab] = useState<'WAIT' | 'DISPUTE' | 'CLOSED'>('DISPUTE');
    
    const filteredItems = useMemo(() => {
        const safeItems = Array.isArray(items) ? items : [];
        if (tab === 'WAIT') return safeItems.filter((i: any) => (i.status || '').toLowerCase().includes('aguardando'));
        if (tab === 'CLOSED') return safeItems.filter((i: any) => (i.status || '').toLowerCase().includes('encerrado'));
        return safeItems.filter((i: any) => !(i.status || '').toLowerCase().includes('aguardando') && !(i.status || '').toLowerCase().includes('encerrado'));
    }, [items, tab]);

    const counts = useMemo(() => {
        const safeItems = Array.isArray(items) ? items : [];
        return {
            wait: safeItems.filter((i: any) => (i.status || '').toLowerCase().includes('aguardando')).length,
            dispute: safeItems.filter((i: any) => !(i.status || '').toLowerCase().includes('aguardando') && !(i.status || '').toLowerCase().includes('encerrado')).length,
            closed: safeItems.filter((i: any) => (i.status || '').toLowerCase().includes('encerrado')).length
        };
    }, [items]);

    return (
        <Card className="bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden transition-all duration-500">
            <CardHeader className="bg-slate-50/80 py-4 px-6 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-center">
                    <div className="flex-1">
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">Dispensa {session.numero} | UASG {session.uasg} - {session.uasgName || 'Sessão Detectada'}</h3>
                        <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-[9px] font-bold bg-white text-slate-400 border-slate-200">Modo Aberto</Badge>
                            <Badge className="text-[9px] font-bold bg-emerald-500 text-white border-none">EXECUTANDO ITENS</Badge>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="p-6 bg-white">
                    <div className="flex justify-center items-center gap-2 mb-8 relative">
                        <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
                            <button onClick={() => setTab('WAIT')} className={`px-6 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${tab === 'WAIT' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Aguardando {counts.wait > 0 && `(${counts.wait})`}</button>
                            <button onClick={() => setTab('DISPUTE')} className={`px-6 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${tab === 'DISPUTE' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Em disputa ({counts.dispute})</button>
                            <button onClick={() => setTab('CLOSED')} className={`px-6 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${tab === 'CLOSED' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Encerrados {counts.closed > 0 && `(${counts.closed})`}</button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {filteredItems.length === 0 ? <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-2xl"><Search className="w-10 h-10 text-slate-200 mx-auto mb-4" /><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum item nesta categoria.</p></div> : filteredItems.map((item: any) => (
                            <SigaItemRow key={item.itemId} item={item} sid={sid} onSaveStrategy={onSaveStrategy} onQuickBid={onQuickBid} />
                        ))}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

function SigaItemRow({ item, sid, onSaveStrategy, onQuickBid }: any) {
    const isWinning = item.ganhador === 'Você' || item.position === 1;
    return (
        <div className={`p-6 rounded-xl border transition-all duration-300 ${isWinning ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
            <div className="grid grid-cols-12 gap-6 items-center">
                <div className="col-span-3">
                    <div className="flex items-center gap-3 mb-2"><span className="text-xs font-black text-slate-900 uppercase tracking-tighter">ITEM {item.itemId}</span></div>
                    <Badge className={`text-[10px] font-black uppercase px-3 py-1 rounded-sm ${isWinning ? 'bg-emerald-500' : 'bg-red-500'}`}>{isWinning ? 'Ganhando' : 'Perdendo'}</Badge>
                    <p className="text-[10px] text-slate-400 mt-2 truncate max-w-[200px]">{item.desc || 'Descrição'}</p>
                </div>
                <div className="col-span-3 flex gap-4">
                    <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Lance mínimo</label>
                        <input type="text" className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-xs font-black outline-none focus:border-black/20" placeholder="0,00" />
                    </div>
                </div>
                <div className="col-span-3 grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-between px-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Atual</span><span className="text-xs font-black text-red-500">R$ {item.valorAtual?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex items-center justify-between px-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Meu</span><span className="text-xs font-black text-slate-800">R$ {item.meuValor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-6 border-l border-slate-100 pl-6">
                    <div className="flex flex-col items-center"><span className="text-lg font-mono font-black text-slate-900">{item.timeout || '00:00:00'}</span></div>
                    <button className="w-10 h-10 rounded-full border-2 border-red-500 flex items-center justify-center group hover:bg-red-500 transition-all"><StopCircle className="w-5 h-5 text-red-500 group-hover:text-white" /></button>
                </div>
            </div>
        </div>
    );
}
