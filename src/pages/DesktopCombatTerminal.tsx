import React, { useState, useEffect } from 'react';
import { 
    Zap, Target, Activity, Monitor, Plus, X, 
    Maximize2, Shield, Lock, Power, LayoutGrid, 
    ListFilter, AlertCircle, TrendingDown, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';

interface SessionData {
    sessionId: string;
    uasg: string;
    numero: string;
    ano: string;
    items: any[];
    status: 'idle' | 'running' | 'error' | 'syncing';
    lastUpdate?: string;
}

export default function DesktopCombatTerminal() {
    const [activeSessions, setActiveSessions] = useState<Record<string, SessionData>>({});
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newUasg, setNewUasg] = useState('');
    const [newNumero, setNewNumero] = useState('');
    const [newAno, setNewAno] = useState(new Date().getFullYear().toString());
    const [isElectron] = useState(!!(window as any).electronAPI);
    const [kanbanCards, setKanbanCards] = useState<any[]>([]);

    // Faz um preload das oportunidades do Kanban
    useEffect(() => {
        if (isAddOpen) {
            api.get('/kanban/board').then(res => {
                if (res.data.success && res.data.board) {
                    const cards: any[] = [];
                    res.data.board.lists.forEach((l: any) => {
                        l.cards.forEach((c: any) => {
                            if (c.pncpId) cards.push(c);
                        });
                    });
                    setKanbanCards(cards);
                }
            }).catch(console.error);
        }
    }, [isAddOpen]);

    // Conexão com o Motor Visual do Electron
    useEffect(() => {
        if (isElectron && (window as any).electronAPI) {
            const handleUpdate = (data: any) => {
                setActiveSessions(prev => ({
                    ...prev,
                    [data.sessionId]: {
                        ...prev[data.sessionId],
                        items: data.items,
                        lastUpdate: data.timestamp,
                        status: 'running'
                    }
                }));
            };

            const handleError = (data: any) => {
                setActiveSessions(prev => ({
                    ...prev,
                    [data.sessionId]: {
                        ...prev[data.sessionId],
                        status: 'error'
                    }
                }));
                toast.error(`Falha na sessão ${data.sessionId}: ${data.error}`);
            };

            (window as any).electronAPI.onBiddingUpdate(handleUpdate);
            // (window as any).electronAPI.onBiddingError(handleError);
        }
    }, [isElectron]);

    const addSession = async () => {
        if (!newUasg || !newNumero) {
            toast.error("Preencha UASG e Número");
            return;
        }

        try {
            // No Desktop, criamos a sessão e já disparamos o motor visual
            const res = await api.post('/bidding/sessions', {
                uasg: newUasg,
                numeroPregao: newNumero,
                anoPregao: newAno,
                portal: 'compras_gov'
            });

            if (res.data.success) {
                const session = res.data.session;
                
                const newSess: SessionData = {
                    sessionId: session.id,
                    uasg: newUasg,
                    numero: newNumero,
                    ano: newAno,
                    items: [],
                    status: 'syncing'
                };

                setActiveSessions(prev => ({ ...prev, [session.id]: newSess }));
                
                if (isElectron) {
                    (window as any).electronAPI.startVisualBidding({
                        sessionId: session.id,
                        uasg: newUasg,
                        numero: newNumero,
                        ano: newAno,
                        vault: {} // Estratégia padrão
                    });
                }

                setIsAddOpen(false);
                setNewUasg('');
                setNewNumero('');
                toast.success("Sala de Combate Inicializada! 🚀");
            }
        } catch (e) {
            toast.error("Erro ao criar sala de combate");
        }
    };

    const startFromCard = (pncpId: string) => {
        const parts = pncpId.split('-');
        if (parts.length >= 4) {
            setNewUasg(parts[0]);
            setNewNumero(parseInt(parts[2], 10).toString());
            setNewAno(parts[3]);
            // Pequeno delay para os estados atualizarem e a função addSession pegar
            setTimeout(() => {
                // We must pass directly to electron here to avoid async state issues
                const pUasg = parts[0];
                const pNum = parseInt(parts[2], 10).toString();
                const pAno = parts[3];
                const tmpId = 'km-' + Date.now();
                setActiveSessions(prev => ({ ...prev, [tmpId]: { sessionId: tmpId, uasg: pUasg, numero: pNum, ano: pAno, items: [], status: 'syncing' } }));
                if (isElectron) {
                    (window as any).electronAPI.startVisualBidding({
                        sessionId: tmpId, uasg: pUasg, numero: pNum, ano: pAno, vault: {}
                    });
                }
                setIsAddOpen(false);
                toast.success("Sala de Combate Inicializada! 🚀");
            }, 100);
        }
    };

    const stopSession = (sid: string) => {
        if (isElectron) (window as any).electronAPI.stopVisualBidding(sid);
        setActiveSessions(prev => {
            const copy = { ...prev };
            delete copy[sid];
            return copy;
        });
    };

    return (
        <div className="h-screen w-full bg-[#020817] text-emerald-500 font-mono flex flex-col p-4 select-none">
            {/* HUD HEADER */}
            <div className="flex items-center justify-between border-b border-emerald-900/50 pb-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                        <Zap className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tighter uppercase font-['Anton'] text-white">Polaryon <span className="text-emerald-500">Terminal</span></h1>
                        <div className="text-[10px] opacity-70 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                             SISTEMA OPERACIONAL ATIVO | V1.2.23-COMBAT-MODE
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end text-[10px] opacity-60">
                         <span>CPU: 12%</span>
                         <span>LATÊNCIA: 45ms</span>
                    </div>
                    <Button 
                        onClick={() => setIsAddOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-black font-bold uppercase py-1 px-4 text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    >
                        <Plus className="w-4 h-4" /> Novo Combate
                    </Button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* LEFT: SESSION GRID */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar p-1">
                    <AnimatePresence>
                        {Object.values(activeSessions).map((session) => (
                            <motion.div
                                key={session.sessionId}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="relative group"
                            >
                                <Card className="bg-black/40 border-emerald-500/20 backdrop-blur-md border hover:border-emerald-500/50 transition-all flex flex-col overflow-hidden">
                                    {/* Session Header */}
                                    <div className="p-3 bg-emerald-500/5 border-b border-emerald-500/10 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                                                UASG {session.uasg}
                                            </Badge>
                                            <span className="text-xs font-bold text-white uppercase">{session.numero}/{session.ano}</span>
                                        </div>
                                        <button onClick={() => stopSession(session.sessionId)} className="text-red-500/60 hover:text-red-500 transition-colors">
                                            <Power className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Items Summary - List View */}
                                    <div className="p-3 space-y-2 min-h-[140px] max-h-[220px] overflow-y-auto custom-scrollbar">
                                        {session.items.length === 0 ? (
                                            <div className="h-32 flex flex-col items-center justify-center opacity-30 gap-2">
                                                <Monitor className="w-8 h-8" />
                                                <span className="text-[10px] uppercase">Aguardando dados...</span>
                                            </div>
                                        ) : (
                                            session.items.map((item: any, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-[11px] bg-emerald-500/5 p-2 rounded border border-emerald-500/5">
                                                    <div className="flex flex-col">
                                                        <span className="text-white/60 uppercase">Item {item.itemId}</span>
                                                        <span className="font-bold text-white text-xs">R$ {item.valorAtual.toLocaleString('pt-BR')}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <Badge className={item.ganhador === 'Você' ? 'bg-emerald-500 text-black border-none' : 'bg-red-900/50 text-red-500 border border-red-500/20'}>
                                                            {item.ganhador === 'Você' ? 'MEU LANCE' : 'PERDENDO'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Bottom Controls */}
                                    <div className="p-2 bg-emerald-500/5 border-t border-emerald-500/10 grid grid-cols-2 gap-2">
                                        <Button variant="outline" className="h-7 text-[10px] border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-black">
                                            <Monitor className="w-3 h-3 mr-1" /> Focar
                                        </Button>
                                        <Button className="h-7 text-[10px] bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white">
                                            <LayoutGrid className="w-3 h-3 mr-1" /> Sala
                                        </Button>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* Empty State / Add Card */}
                    {Object.keys(activeSessions).length === 0 && (
                        <div className="col-span-full flex flex-col gap-6">
                            <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-emerald-900/30 rounded-lg group hover:border-emerald-500/30 transition-all cursor-pointer" onClick={() => setIsAddOpen(true)}>
                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <Plus className="w-6 h-6 opacity-40 group-hover:opacity-100" />
                                </div>
                                <p className="text-[10px] uppercase tracking-[0.2em] opacity-40">Engajamento Manual. Clique para adicionar.</p>
                            </div>

                            {kanbanCards.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black uppercase text-emerald-500/60 tracking-widest flex items-center gap-2">
                                        <Target className="w-3 h-3" /> Objetivos Sincronizados (Kanban)
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {kanbanCards.map(c => (
                                            <div 
                                                key={c.id} 
                                                onClick={() => startFromCard(c.pncpId)}
                                                className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-lg cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all group/card flex flex-col gap-2 relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover/card:opacity-20 transition-opacity">
                                                    <Zap className="w-8 h-8" />
                                                </div>
                                                <div className="flex justify-between items-start">
                                                    <div className="text-white font-bold text-sm uppercase truncate pr-8">{c.title}</div>
                                                </div>
                                                <div className="flex items-center justify-between mt-auto">
                                                    <div className="text-emerald-500 font-mono text-[9px] truncate">PNCP: {c.pncpId}</div>
                                                    <Button className="h-6 px-3 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-[9px] rounded uppercase shadow-[0_0_10px_rgba(16,185,129,0.2)]">Engajar</Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT: GLOBAL COMBAT FEED */}
                <div className="w-80 border-l border-emerald-900/30 flex flex-col pl-4 hidden xl:flex">
                    <div className="flex items-center gap-2 mb-4">
                        <ListFilter className="w-4 h-4 text-emerald-500" />
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/50">Feed Global de Operações</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 opacity-80">
                        <div className="text-[9px] border-l-2 border-emerald-500 pl-2 py-1">
                             <div className="text-emerald-500 font-bold">[14:52:10] SISTEMA ANTIGRAVIDADE</div>
                             <div className="text-white">Motor Visual Polaryon inicializado com sucesso.</div>
                        </div>
                        {Object.values(activeSessions).map(s => (
                            <div key={s.sessionId} className="text-[9px] border-l-2 border-white/20 pl-2 py-1">
                             <div className="text-white/40 font-bold">[{new Date().toLocaleTimeString()}] SALA {s.uasg}</div>
                             <div className="text-white/60">Monitorando {s.items.length} itens em tempo real.</div>
                        </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* MODAL NOVO COMBATE */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#0b101e] border border-emerald-500/30 p-6 rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-white font-bold text-lg flex items-center gap-2">
                                <Activity className="w-5 h-5 text-emerald-500" /> INICIAR OPERAÇÃO
                            </h2>
                            <button onClick={() => setIsAddOpen(false)}><X className="w-5 h-5 opacity-40" /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase opacity-60 mb-1 block">UASG / Órgão</label>
                                <Input 
                                    value={newUasg} 
                                    onChange={e => setNewUasg(e.target.value)}
                                    placeholder="Ex: 160001" 
                                    className="bg-black/50 border-emerald-500/20 text-white font-mono h-10"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase opacity-60 mb-1 block">Número do Edital</label>
                                    <Input 
                                        value={newNumero} 
                                        onChange={e => setNewNumero(e.target.value)}
                                        placeholder="Ex: 90001" 
                                        className="bg-black/50 border-emerald-500/20 text-white font-mono h-10"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase opacity-60 mb-1 block">Ano</label>
                                    <Input 
                                        value={newAno} 
                                        onChange={e => setNewAno(e.target.value)}
                                        placeholder="2026" 
                                        className="bg-black/50 border-emerald-500/20 text-white font-mono h-10"
                                    />
                                </div>
                            </div>

                            <Button 
                                onClick={addSession}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-bold h-12 uppercase tracking-widest mt-4"
                            >
                                Carregar Sala de Lances Manual
                            </Button>

                            {kanbanCards.length > 0 && (
                                <div className="mt-6 border-t border-emerald-500/20 pt-4">
                                    <label className="text-[10px] uppercase font-bold text-emerald-500 mb-3 block text-center">Ou escolha do seu Planejamento (Kanban)</label>
                                    <div className="max-h-[200px] overflow-y-auto space-y-2 custom-scrollbar pr-2">
                                        {kanbanCards.map(c => (
                                            <div 
                                                key={c.id} 
                                                onClick={() => startFromCard(c.pncpId)}
                                                className="bg-black/30 border border-emerald-500/10 p-3 rounded cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-colors"
                                            >
                                                <div className="text-white text-xs font-bold truncate">{c.title}</div>
                                                <div className="text-white/40 text-[9px] mt-1 uppercase truncate font-mono">PNCP: {c.pncpId}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* STATUS BAR FOOTER */}
            <div className="h-6 border-t border-emerald-900/50 mt-4 flex items-center justify-between text-[9px] opacity-40 uppercase tracking-tighter">
                <div className="flex gap-4">
                    <span>POLARYON ENGINE: v1.2.23</span>
                    <span>SECURE TUNNEL: ACTIVE</span>
                    <span>GOV.BR BRIDGE: STANDBY</span>
                </div>
                <div>
                     SYSTEM TIME: {new Date().toLocaleTimeString()}
                </div>
            </div>
        </div>
    );
}
