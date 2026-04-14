import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, Activity, RefreshCw, Play, Square, Settings2, Target, Zap, Shield, Key, History, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
    const [actionLogs, setActionLogs] = useState<any[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showRealModeWarning, setShowRealModeWarning] = useState(false);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [serverOffset, setServerOffset] = useState(0);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [coveredItems, setCoveredItems] = useState<Set<string>>(new Set());
    const [isDesktop] = useState(!!(window as any).electronAPI?.isDesktop);
    const [isLocalRunning, setIsLocalRunning] = useState(false);

    // TODO: In real app, fetch credentials dynamically
    const dummyCredentialId = 'simulated-credential-id';

    const startRadar = async () => {
        if (!uasg || !numeroPregao) {
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
                    uasg,
                    numeroPregao,
                    anoPregao
                });

                if (res.data.success) {
                    const session = res.data.session;
                    setSessionId(session.id);

                    // 2. Buscar Vault (Certificado decriptado para assinar localmente)
                    if (selectedCredentialId && selectedCredentialId !== dummyCredentialId) {
                        try {
                            const vaultRes = await api.get(`/bidding/credentials/${selectedCredentialId}/vault`);
                            if (vaultRes.data.success) {
                                (window as any).electronAPI.startLocalBidding({
                                    sessionId: session.id,
                                    uasg,
                                    numero: numeroPregao,
                                    ano: anoPregao,
                                    vault: vaultRes.data.vault
                                });
                                setIsLocalRunning(true);
                                setIsListening(true);
                                toast.success("Radar LOCAL ativado via Desktop! 📡⚡");
                                return;
                            }
                        } catch (e) {
                            console.error("Failed to fetch vault for local usage", e);
                        }
                    }
                    
                    // Fallback para modo nuvem se o vault falhar ou não houver credencial real
                    toast.info("Iniciando via Nuvem (Backup)...");
                }
            }

            // MODO CLOUD (Original)
            const res = await api.post('/bidding/sessions', {
                credentialId: selectedCredentialId || dummyCredentialId,
                portal: 'compras_gov',
                uasg,
                numeroPregao,
                anoPregao
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

    const stopRadar = async () => {
        if (!sessionId) return;
        try {
            if (isLocalRunning && (window as any).electronAPI) {
                (window as any).electronAPI.stopLocalBidding(sessionId);
                setIsLocalRunning(false);
            } else {
                await api.post(`/bidding/sessions/${sessionId}/stop`);
                if (socketService) {
                    socketService.emit('leave_bidding_room', sessionId);
                }
            }
            setIsListening(false);
        } catch (error) {
            console.error("Failed to stop radar:", error);
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

        if (uasgParam) setUasg(uasgParam);
        if (numeroParam) setNumeroPregao(numeroParam);
        if (anoParam) setAnoPregao(anoParam);
        
        if (uasgParam && numeroParam) {
            import('sonner').then(({ toast }) => toast.info("Dados do Radar carregados com sucesso."));
        }
    }, [searchParams]);

    // ELECTRON LOCAL RUNNER LISTENER
    useEffect(() => {
        if (isDesktop && (window as any).electronAPI) {
            const handleUpdate = (data: any) => {
                if (data.sessionId === sessionId) {
                    setItems(data.items);
                    setLastUpdate(data.timestamp);
                    if (data.turbo !== undefined) setTurbo(data.turbo);
                }
            };
            
            const handleError = (data: any) => {
                if (data.sessionId === sessionId) {
                    toast.error(`Erro no motor local: ${data.error}`);
                }
            };
            
            const handleChat = (data: any) => {
                if (data.messages) {
                    setChatMessages(data.messages);
                }
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

    const saveStrategy = async (itemId: string, strategy: ItemStrategy) => {
        if (!sessionId) return;
        try {
            await api.patch(`/bidding/sessions/${sessionId}/items/${itemId}`, {
                ...strategy,
                simulationMode // Pass global simulation mode to item config
            });
            setItemStrategies(prev => ({ ...prev, [itemId]: strategy }));
        } catch (error) {
            console.error("Failed to save strategy:", error);
        }
    };

    // Toggle Simulation Mode for the whole session
    const toggleSimulation = async (val: boolean) => {
        setSimulationMode(val);
        if (sessionId) {
            try {
                // Update first item or a special key to sync global simulation mode
                await api.patch(`/bidding/sessions/${sessionId}/items/__global__`, { simulationMode: val });
                import('sonner').then(({ toast }) => toast.info(`Modo ${val ? 'SIMULADO' : 'REAL'} ativado.`));
            } catch (e) {
                console.error("Failed to sync simulation mode", e);
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
                        {turbo && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 rounded-full border border-red-500/20 animate-pulse">
                                <Zap className="w-3 h-3 fill-current" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Modo Turbo</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3 px-6 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                            <span className="text-sm font-bold uppercase tracking-widest">Radar Ativo</span>
                        </div>
                    </div>
                )}
            </div>

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
                                <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider">Nº Pregão</Label>
                                <Input 
                                    value={numeroPregao} 
                                    onChange={e => setNumeroPregao(e.target.value)} 
                                    placeholder="Ex: 12" 
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

                        <div className="pt-4">
                            {!isListening ? (
                                <Button onClick={startRadar} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 shadow-emerald-900/20 shadow-xl transition-all hover:scale-[1.02] active:scale-95">
                                    <Play className="w-4 h-4 mr-2 fill-current"/> ATIVAR ROBÔ
                                </Button>
                            ) : (
                                <Button onClick={stopRadar} variant="destructive" className="w-full font-bold h-12 shadow-red-900/20 shadow-xl transition-all hover:scale-[1.02] active:scale-95">
                                    <Square className="w-4 h-4 mr-2 fill-current"/> PARAR OPERAÇÃO
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
                                <div key={idx} className="p-3 bg-slate-950/50 rounded-xl border border-white/5 space-y-1.5 animate-in slide-in-from-right-4 duration-300">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${log.type === 'SIMULATED' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                                {log.type}
                                            </span>
                                            {log.status === 'error' && (
                                                <AlertTriangle className="w-3 h-3 text-red-500" />
                                            )}
                                        </div>
                                        <span className="text-[9px] font-mono text-slate-500">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className={`text-xs font-bold ${log.status === 'error' ? 'text-red-400' : 'text-slate-200'}`}>
                                        ITEM {log.itemId} <span className="text-slate-400 font-medium">→</span> <span className={log.status === 'error' ? 'text-red-400' : 'text-emerald-400'}>R$ {log.value.toFixed(2)}</span>
                                    </p>
                                    <p className="text-[10px] text-slate-500 italic">"{log.error || log.reason}"</p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

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
