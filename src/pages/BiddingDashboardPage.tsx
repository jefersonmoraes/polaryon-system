import { useState, useEffect } from 'react';
import { ShieldAlert, Activity, RefreshCw, Play, Square, Settings2, Target, Zap, Shield } from 'lucide-react';
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

    // TODO: In real app, fetch credentials dynamically
    const dummyCredentialId = 'simulated-credential-id';

    const startRadar = async () => {
        if (!uasg || !numeroPregao) return;
        
        try {
            const res = await api.post('/bidding/sessions', {
                credentialId: dummyCredentialId,
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
            }
        } catch (error) {
            console.error("Failed to start radar:", error);
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

    const saveStrategy = async (itemId: string, strategy: ItemStrategy) => {
        if (!sessionId) return;
        try {
            await api.patch(`/bidding/sessions/${sessionId}/items/${itemId}`, strategy);
            setItemStrategies(prev => ({ ...prev, [itemId]: strategy }));
        } catch (error) {
            console.error("Failed to save strategy:", error);
        }
    };

    useEffect(() => {
        if (!socketService) return;

        const handleUpdate = (data: any) => {
            setItems(data.items);
            setLastUpdate(new Date().toLocaleTimeString());
        };

        socketService.on('biddingUpdate', handleUpdate);

        return () => {
            socketService.off('biddingUpdate', handleUpdate);
            if (sessionId && isListening) {
                stopRadar();
            }
        };
    }, [socketService, sessionId, isListening]);

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                        Polaryon Bidding Engine
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        O Cérebro: Estratégias de Lances Automáticos (Etapa 3)
                    </p>
                </div>
                {isListening && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 animate-pulse self-start md:self-center">
                        <Activity className="w-4 h-4" />
                        <span className="text-sm font-semibold uppercase tracking-wider">Radar Ativo</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Controls Card */}
                <Card className="md:col-span-1 shadow-lg border-t-4 border-t-emerald-500 bg-white/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-emerald-500"/> Configuração do Pregão
                        </CardTitle>
                        <CardDescription>Monitore a sala de lances em tempo real.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>UASG / Código do Órgão</Label>
                            <Input value={uasg} onChange={e => setUasg(e.target.value)} placeholder="Ex: 160045" disabled={isListening} className="bg-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nº Pregão</Label>
                                <Input value={numeroPregao} onChange={e => setNumeroPregao(e.target.value)} placeholder="Ex: 12" disabled={isListening} className="bg-white" />
                            </div>
                            <div className="space-y-2">
                                <Label>Ano</Label>
                                <Input value={anoPregao} onChange={e => setAnoPregao(e.target.value)} disabled={isListening} className="bg-white" />
                            </div>
                        </div>
                        
                        <div className="pt-4 flex flex-col gap-2">
                            {!isListening ? (
                                <Button onClick={startRadar} className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 shadow-lg transition-all active:scale-95">
                                    <Play className="w-4 h-4 mr-2"/> Ligar Radar
                                </Button>
                            ) : (
                                <Button onClick={stopRadar} variant="destructive" className="w-full shadow-red-100 shadow-lg transition-all active:scale-95">
                                    <Square className="w-4 h-4 mr-2"/> Desligar Radar
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Dashboard Monitor */}
                <Card className="md:col-span-2 shadow-xl border-none bg-slate-50/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                        <div>
                            <CardTitle className="text-xl">Sala de Disputa</CardTitle>
                            <CardDescription>Todos os itens e lances monitorados.</CardDescription>
                        </div>
                        <div className="text-right">
                             <div className="text-xs font-mono text-muted-foreground">Último Sync: {lastUpdate || '--:--:--'}</div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {!isListening ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl bg-white/40">
                                <Zap className="w-16 h-16 mb-4 text-slate-200" />
                                <p className="font-medium">Motor desligado. Configure o pregão para iniciar o Radar.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {items.map(item => {
                                    const strategy = itemStrategies[item.itemId] || { mode: 'follower', minPrice: 0, decrementValue: 0.10, decrementType: 'fixed' };
                                    
                                    let statusBg = "bg-white";
                                    let dotColor = "bg-slate-400";
                                    
                                    if (item.ganhador === 'Você') {
                                        statusBg = "bg-emerald-50/80 border-emerald-100";
                                        dotColor = "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]";
                                    } else {
                                        statusBg = "bg-amber-50/80 border-amber-100";
                                        dotColor = "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]";
                                    }

                                    return (
                                        <div key={item.itemId} className={`p-4 border rounded-2xl flex items-center justify-between transition-all hover:shadow-md ${statusBg}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-3 h-3 rounded-full animate-pulse ${dotColor}`}></div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800">ITEM {item.itemId}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                                            {strategy.mode}
                                                        </span>
                                                        <p className="text-xs text-muted-foreground">Min: R$ {strategy.minPrice.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-8">
                                                <div className="text-right">
                                                    <div className="text-lg font-black text-slate-900">R$ {item.valorAtual.toFixed(2)}</div>
                                                    <p className={`text-[10px] font-bold uppercase ${item.ganhador === 'Você' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {item.ganhador}
                                                    </p>
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
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200 transition-colors">
                    <Settings2 className="w-5 h-5 text-slate-500" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-500" /> Configurar Item {item.itemId}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="space-y-2">
                        <Label>Modo de Disputa</Label>
                        <Select value={strategy.mode} onValueChange={(v: any) => setStrategy({...strategy, mode: v})}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="follower">Seguidor (Reação Imediata)</SelectItem>
                                <SelectItem value="sniper">Sniper (Segundo Final)</SelectItem>
                                <SelectItem value="cover">Cobertura (Sempre Topo)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground italic">
                            {strategy.mode === 'follower' && "Reage instantaneamente a cada lance baixado por concorrentes."}
                            {strategy.mode === 'sniper' && "Aguardará o encerramento iminente para dar o lance único."}
                            {strategy.mode === 'cover' && "Garantirá que seu lance seja o melhor até o preço mínimo."}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Preço Mínimo (Reserva)</Label>
                            <Input 
                                type="number" 
                                value={strategy.minPrice} 
                                onChange={e => setStrategy({...strategy, minPrice: parseFloat(e.target.value)})}
                                className="font-mono font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Decremento</Label>
                            <Input 
                                type="number" 
                                value={strategy.decrementValue} 
                                onChange={e => setStrategy({...strategy, decrementValue: parseFloat(e.target.value)})}
                                className="font-mono"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Tipo de Decremento</Label>
                        <Select value={strategy.decrementType} onValueChange={(v: any) => setStrategy({...strategy, decrementType: v})}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                                <SelectItem value="percent">Percentual (%)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => onSave(strategy)} className="bg-emerald-600 hover:bg-emerald-700 w-full">
                        Salvar Estratégia
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
