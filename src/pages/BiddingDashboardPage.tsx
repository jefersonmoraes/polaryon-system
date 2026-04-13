import { useState, useEffect } from 'react';
import { ShieldAlert, Activity, RefreshCw, Play, Square, Settings2, Target, Zap, Shield, Key, History, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { socketService } from '@/lib/socket';
import { useAuthStore } from '../store/auth-store';
import api from '@/lib/api';
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

interface BiddingItem {
    itemId: string;
    valorAtual: number;
    ganhador: string;
    status: string;
}

interface ItemStrategy {
    mode: 'follower' | 'sniper' | 'cover';
    minPrice: number;
    decrementValue: number;
    decrementType: 'fixed' | 'percent';
}

export default function BiddingDashboardPage() {
    const { currentUser: authUser } = useAuthStore();
    
    const [uasg, setUasg] = useState('');
    const [numeroPregao, setNumeroPregao] = useState('');
    const [anoPregao, setAnoPregao] = useState(new Date().getFullYear().toString());
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [items, setItems] = useState<BiddingItem[]>([]);
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);
    const [itemStrategies, setItemStrategies] = useState<Record<string, ItemStrategy>>({});
    const [simulationMode, setSimulationMode] = useState(true);
    const [credentials, setCredentials] = useState<any[]>([]);
    const [selectedCredentialId, setSelectedCredentialId] = useState<string>('');
    const [actionLogs, setActionLogs] = useState<any[]>([]);

    // TODO: In real app, fetch credentials dynamically
    const dummyCredentialId = 'simulated-credential-id';

    const startRadar = async () => {
        if (!uasg || !numeroPregao) {
            import('sonner').then(({ toast }) => toast.error("Preencha UASG e Nº do Pregão."));
            return;
        }
        
        try {
            // Attempt to create session. 
            // In Etapa 4, we would fetch real credentialId from a list.
            const res = await api.post('/bidding/sessions', {
                credentialId: dummyCredentialId, // Backend will convert this to null if it's the dummy ⚒️🚀⚙️
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
                import('sonner').then(({ toast }) => toast.success("Radar Polaryon ativado com sucesso! ⚡"));
            }
        } catch (error: any) {
            console.error("Failed to start radar:", error);
            const msg = error.response?.data?.error || "Erro ao conectar com o servidor de lances.";
            import('sonner').then(({ toast }) => toast.error(msg));
        }
    };

    const stopRadar = async () => {
        if (!sessionId) return;
        try {
            await api.post(`/bidding/sessions/${sessionId}/stop`);
            if (socketService) {
                socketService.emit('leave_bidding_room', sessionId);
            }
            setIsListening(false);
        } catch (error) {
            console.error("Failed to stop radar:", error);
        }
    };

    useEffect(() => {
        const fetchCredentials = async () => {
            if (!authUser?.id) return;
            try {
                // Fetch profiles first to get companyId
                const profileRes = await api.get('/accounting/profiles');
                const defaultCompany = profileRes.data.find((p: any) => p.isDefault) || profileRes.data[0];
                
                if (defaultCompany) {
                    const res = await api.get('/bidding/credentials', { params: { companyId: defaultCompany.id } });
                    setCredentials(res.data.credentials || []);
                    if (res.data.credentials?.length > 0) {
                        setSelectedCredentialId(res.data.credentials[0].id);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch credentials", e);
            }
        };
        fetchCredentials();
    }, [authUser]);

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
                setActionLogs(prev => [...data.actions, ...prev].slice(0, 50));
            }
            setLastUpdate(new Date().toLocaleTimeString());
        };

        const handleAlert = (alert: any) => {
            import('sonner').then(({ toast }) => {
                if (alert.critical) {
                    toast.error(alert.message, { duration: 10000 });
                    // Optional: Play alert sound here if allowed
                } else {
                    toast.warning(alert.message);
                }
            });
        };

        socketService.on('biddingUpdate', handleUpdate);
        socketService.on('bidding_alert', handleAlert);

        return () => {
            socketService.off('biddingUpdate', handleUpdate);
            socketService.off('bidding_alert', handleAlert);
        };
    }, [socketService, sessionId, isListening]);

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent">
                        Polaryon Bidding Engine
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">
                        O Cérebro: Estratégias de Lances Automáticos <span className="text-emerald-500/80">(V3.0 Beta)</span>
                    </p>
                </div>
                {isListening && (
                    <div className="flex items-center gap-3 px-6 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                        <span className="text-sm font-bold uppercase tracking-widest">Radar Ativo</span>
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
                                    onCheckedChange={toggleSimulation}
                                    className="data-[state=checked]:bg-amber-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                    <Key className="w-3 h-3" /> Conta de Disputa (Certificado)
                                </Label>
                                <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId} disabled={isListening}>
                                    <SelectTrigger className="bg-slate-950/50 border-white/10 text-slate-100 h-11">
                                        <SelectValue placeholder="Selecione um certificado..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-white/10 text-slate-100">
                                        {credentials.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                                                {c.alias} ({c.cnpj})
                                            </SelectItem>
                                        ))}
                                        {credentials.length === 0 && (
                                            <SelectItem value="none" disabled>Nenhum certificado encontrado</SelectItem>
                                        )}
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
                    <CardContent className="pt-6 relative min-h-[300px]">
                        {!isListening ? (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                                <div className="p-6 rounded-full bg-slate-800/30 mb-6 ring-1 ring-white/5">
                                    <Zap className="w-12 h-12 text-slate-600" />
                                </div>
                                <p className="font-semibold text-slate-400">Motor em Standby</p>
                                <p className="text-sm text-slate-500 mt-1 text-center max-w-[200px]">Configure o pregão para iniciar o monitoramento.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {items.map(item => {
                                    const strategy = itemStrategies[item.itemId] || { mode: 'follower', minPrice: 0, decrementValue: 0.10, decrementType: 'fixed' };
                                    
                                    let statusBg = "bg-slate-800/40 ring-1 ring-white/5";
                                    let dotColor = "bg-slate-600";
                                    let priceColor = "text-slate-100";
                                    
                                    if (item.ganhador === 'Você') {
                                        statusBg = "bg-emerald-500/5 ring-1 ring-emerald-500/30";
                                        dotColor = "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]";
                                        priceColor = "text-emerald-400";
                                    } else {
                                        statusBg = "bg-amber-500/5 ring-1 ring-amber-500/30";
                                        dotColor = "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]";
                                        priceColor = "text-amber-400";
                                    }

                                    return (
                                        <div key={item.itemId} className={`p-5 rounded-2xl flex items-center justify-between transition-all hover:translate-x-1 ${statusBg}`}>
                                            <div className="flex items-center gap-5">
                                                <div className={`w-3.5 h-3.5 rounded-full ${dotColor}`}></div>
                                                <div>
                                                    <h4 className="font-black text-slate-200 tracking-tight">ITEM {item.itemId}</h4>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-white/5">
                                                            {strategy.mode}
                                                        </span>
                                                        <p className="text-[10px] font-bold text-slate-500">RES: R$ {strategy.minPrice.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-10">
                                                <div className="text-right">
                                                    <div className={`text-2xl font-black tabular-nums tracking-tighter ${priceColor}`}>R$ {item.valorAtual.toFixed(2)}</div>
                                                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                                        <p className={`text-[10px] font-black uppercase tracking-tighter ${item.ganhador === 'Você' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                            {item.ganhador}
                                                        </p>
                                                    </div>
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
                        )}
                    </CardContent>
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
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${log.type === 'SIMULATED' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                            {log.type}
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-500">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-200">
                                        ITEM {log.itemId} <span className="text-slate-400 font-medium">→</span> <span className="text-emerald-400">R$ {log.value.toFixed(2)}</span>
                                    </p>
                                    <p className="text-[10px] text-slate-500 italic">"{log.reason}"</p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StrategyModal({ item, initialStrategy, onSave }: { item: BiddingItem, initialStrategy: ItemStrategy, onSave: (s: ItemStrategy) => void }) {
    const [strategy, setStrategy] = useState<ItemStrategy>(initialStrategy);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-white/10 transition-colors h-11 w-11 border border-white/5">
                    <Settings2 className="w-5 h-5 text-slate-400" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-900 border-white/10 text-slate-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-2xl font-black">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <Shield className="w-6 h-6 text-emerald-500" />
                        </div>
                        ITEM {item.itemId}
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
                                <SelectItem value="cover" className="text-sm font-bold">Cobertura (Sempre Topo)</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5">
                            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                {strategy.mode === 'follower' && "⚡ Reage instantaneamente a cada lance baixado por concorrentes."}
                                {strategy.mode === 'sniper' && "🎯 Aguardará o encerramento iminente para dar o lance único."}
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
