import { useState, useEffect } from 'react';
import { Play, Square, ShieldAlert, Activity, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useSocketStore } from '../store/socket-store';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import { useAuthStore } from '../store/auth-store';
import api from '@/lib/api';

interface BiddingItem {
    itemId: string;
    valorAtual: number;
    ganhador: string;
    status: string;
}

export default function BiddingDashboardPage() {
    const { user } = useAuthStore();
    const socket = useSocketStore(state => state.socket);
    
    const [uasg, setUasg] = useState('');
    const [numeroPregao, setNumeroPregao] = useState('');
    const [anoPregao, setAnoPregao] = useState(new Date().getFullYear().toString());
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [items, setItems] = useState<BiddingItem[]>([]);
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);

    // TODO: In real app, fetch credentials dynamically
    const dummyCredentialId = 'simulated-credential-id';

    const startRadar = async () => {
        if (!uasg || !numeroPregao) return;
        
        try {
            // 1. Create session
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
                
                // 2. Join Socket Room (We call the store's socket directly)
                if (socket) {
                    socket.emit('join_bidding_room', newSessionId);
                }

                // 3. Start Backend Poller
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
            
            if (socket) {
                socket.emit('leave_bidding_room', sessionId);
            }
            
            setIsListening(false);
        } catch (error) {
            console.error("Failed to stop radar:", error);
        }
    };

    useEffect(() => {
        if (!socket) return;

        const handleUpdate = (data: any) => {
            setItems(data.items);
            setLastUpdate(new Date().toLocaleTimeString());
        };

        socket.on('biddingUpdate', handleUpdate);

        return () => {
            socket.off('biddingUpdate', handleUpdate);
            // Cleanup on unmount
            if (sessionId && isListening) {
                stopRadar();
            }
        };
    }, [socket, sessionId, isListening]);

    return (
        <ProtectedRoute>
            <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                        Polaryon Bidding Engine
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Radar de Monitoramento em Tempo Real - Etapa 2
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Controls Card */}
                    <Card className="md:col-span-1 shadow-md border-t-4 border-t-emerald-500">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="w-5 h-5 text-emerald-500"/> Configuração
                            </CardTitle>
                            <CardDescription>Defina o pregão para monitorar.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>UASG</Label>
                                <Input value={uasg} onChange={e => setUasg(e.target.value)} placeholder="Ex: 160045" disabled={isListening} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Pregão</Label>
                                    <Input value={numeroPregao} onChange={e => setNumeroPregao(e.target.value)} placeholder="Ex: 12" disabled={isListening} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Ano</Label>
                                    <Input value={anoPregao} onChange={e => setAnoPregao(e.target.value)} disabled={isListening} />
                                </div>
                            </div>
                            
                            <div className="pt-4 flex flex-col gap-2">
                                {!isListening ? (
                                    <Button onClick={startRadar} className="w-full bg-emerald-600 hover:bg-emerald-700">
                                        <Play className="w-4 h-4 mr-2"/> Ligar Radar
                                    </Button>
                                ) : (
                                    <Button onClick={stopRadar} variant="destructive" className="w-full">
                                        <Square className="w-4 h-4 mr-2"/> Desligar Radar
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dashboard Monitor */}
                    <Card className="md:col-span-2 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle>Itens da Disputa</CardTitle>
                                <CardDescription>Monitoramento real-time da sala de lances.</CardDescription>
                            </div>
                            {isListening && (
                                <div className="flex items-center text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full animate-pulse">
                                    <RefreshCw className="w-3 h-3 mr-1" /> Conecção Ativa (Ping: ~42ms)
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            {!isListening ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                    <ShieldAlert className="w-12 h-12 mb-4 text-slate-300" />
                                    <p>Radar desligado. Informe UASG e Pregão para iniciar.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {items.map(item => {
                                        // Semáforo Lógico Simples (Etapa 2)
                                        let statusColor = "bg-slate-100 border-slate-200";
                                        let dotColor = "bg-slate-400";
                                        
                                        if (item.ganhador === 'Você') {
                                            statusColor = "bg-emerald-50 border-emerald-200";
                                            dotColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]";
                                        } else {
                                            statusColor = "bg-amber-50 border-amber-200";
                                            dotColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]";
                                        }

                                        return (
                                            <div key={item.itemId} className={`p-4 border rounded-xl flex items-center justify-between transition-all duration-300 ${statusColor}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-4 h-4 rounded-full ${dotColor}`}></div>
                                                    <div>
                                                        <h4 className="font-semibold text-sm">Item {item.itemId}</h4>
                                                        <p className="text-xs text-muted-foreground">Status: {item.status}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold">R$ {item.valorAtual.toFixed(2)}</div>
                                                    <p className="text-xs text-slate-600">Ganhador: {item.ganhador}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className="text-xs text-right text-muted-foreground mt-4">
                                        Última atualização: {lastUpdate}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </ProtectedRoute>
    );
}
