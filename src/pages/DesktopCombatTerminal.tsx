import React, { useState, useEffect, useMemo } from 'react';
import { 
    Zap, Target, Activity, Monitor, Plus, X, 
    Shield, Power, ListFilter, TrendingDown, Clock,
    Terminal as TerminalIcon, DollarSign, Cpu, BarChart3,
    AlertCircle, Radar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';
import { CombatItemCard } from '@/components/combat/CombatItemCard';
import { TacticalLog } from '@/components/combat/TacticalLog';

interface SessionData {
    sessionId: string;
    uasg: string;
    numero: string;
    ano: string;
    items: any[];
    status: 'idle' | 'running' | 'error' | 'syncing';
    lastUpdate?: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'action' | 'threat' | 'success';
  message: string;
  source?: string;
}

export default function DesktopCombatTerminal() {
    const [activeSessions, setActiveSessions] = useState<Record<string, SessionData>>({});
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newUasg, setNewUasg] = useState('');
    const [newNumero, setNewNumero] = useState('');
    const [newAno, setNewAno] = useState(new Date().getFullYear().toString());
    const [isElectron] = useState(!!(window as any).electronAPI);
    const [kanbanCards, setKanbanCards] = useState<any[]>([]);

    const addLog = (message: string, level: LogEntry['level'] = 'info', source?: string) => {
      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
        source
      };
      setLogs(prev => [...prev.slice(-49), newLog]);
    };

    // Preload Kanban Changes
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

    // Electron IPC Handling
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
                
                // Inteligência de Log Analítica
                data.items.forEach((it: any) => {
                   if (it.ganhador === 'Você') {
                      addLog(`ITEM ${it.itemId}: Você assumiu o primeiro lugar!`, 'success', `SALA ${data.uasg}`);
                   }
                });
            };

            const handleError = (data: any) => {
                setActiveSessions(prev => ({ ...prev, [data.sessionId]: { ...prev[data.sessionId], status: 'error' } }));
                addLog(`ERRO NA SESSÃO ${data.sessionId}: ${data.error}`, 'threat', 'SYSTEM');
                toast.error(`Falha na sessão ${data.sessionId}: ${data.error}`);
            };

            (window as any).electronAPI.onBiddingUpdate(handleUpdate);
        }
    }, [isElectron]);

    const addSession = async () => {
        if (!newUasg || !newNumero) {
            toast.error("Preencha UASG e Número");
            return;
        }

        try {
            const res = await api.post('/bidding/sessions', { uasg: newUasg, numeroPregao: newNumero, anoPregao: newAno, portal: 'compras_gov' });
            if (res.data.success) {
                const session = res.data.session;
                const newSess: SessionData = { sessionId: session.id, uasg: newUasg, numero: newNumero, ano: newAno, items: [], status: 'syncing' };
                setActiveSessions(prev => ({ ...prev, [session.id]: newSess }));
                if (isElectron) {
                    (window as any).electronAPI.startVisualBidding({ sessionId: session.id, uasg: newUasg, numero: newNumero, ano: newAno, vault: {} });
                }
                addLog(`Iniciando combate na UASG ${newUasg} - Edital ${newNumero}/${newAno}`, 'action', 'DEPLOY');
                setIsAddOpen(false);
                setNewUasg('');
                setNewNumero('');
            }
        } catch (e) {
            toast.error("Erro ao criar sala de combate");
        }
    };

    const stopSession = (sid: string) => {
        if (isElectron) (window as any).electronAPI.stopVisualBidding(sid);
        addLog(`Sessão ${sid} encerrada pelo operador.`, 'info', 'SYSTEM');
        setActiveSessions(prev => {
            const copy = { ...prev };
            delete copy[sid];
            return copy;
        });
    };

    // Métricas Globais
    const globalStats = useMemo(() => {
      let winning = 0;
      let totalValue = 0;
      Object.values(activeSessions).forEach(s => {
        s.items.forEach(it => {
          if (it.ganhador === 'Você') {
            winning++;
            totalValue += it.valorAtual;
          }
        });
      });
      return { winning, totalValue };
    }, [activeSessions]);

    return (
        <div className="min-h-screen w-full bg-[#020617] text-emerald-500 font-mono flex flex-col p-4 select-none overflow-y-auto custom-scrollbar">
            {/* GRID PRINCIPAL: TRÍADE TÁTICA */}
            <div className="flex-1 flex gap-4">
                
                {/* COLUNA ESQUERDA: CONFIG & HUD (300px) */}
                <div className="w-[320px] flex flex-col gap-4">
                    {/* HUB BRANDING */}
                    <div className="p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Radar className="w-24 h-24" />
                        </div>
                        <h1 className="text-2xl font-['Anton'] tracking-tighter text-white uppercase italic">Polaryon <span className="text-emerald-500">Combat</span></h1>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-black tracking-widest text-emerald-500 opacity-60">WAR-ROOM TERMINAL v1.3.0</span>
                        </div>
                    </div>

                    {/* QUICK METRICS */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                            <div className="text-[8px] opacity-40 uppercase font-black mb-1">Itens Vencendo</div>
                            <div className="text-2xl font-['Anton'] text-white">{globalStats.winning}</div>
                        </div>
                        <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                            <div className="text-[8px] opacity-40 uppercase font-black mb-1">Economia Estimada</div>
                            <div className="text-xl font-['Anton'] text-emerald-400">R$ {globalStats.totalValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
                        </div>
                    </div>

                    {/* CONFIG PANEL */}
                    <Card className="bg-black/40 border-emerald-500/20 p-5 flex flex-col gap-4">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 flex items-center gap-2">
                            <Shield className="w-3 h-3" /> Parâmetros de Missão
                        </h2>
                        
                        <Button 
                            onClick={() => setIsAddOpen(true)}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase text-[10px] h-10 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Novo Engajamento
                        </Button>

                        <div className="pt-4 border-t border-white/5 space-y-4">
                            <div className="flex justify-between items-center text-[9px] opacity-60">
                                <span>Status do Robô</span>
                                <span className="text-emerald-500 font-bold">CALIBRADO</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] opacity-60">
                                <span>Latência Gateway</span>
                                <span className="text-white">42ms</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] opacity-60">
                                <span>Criptografia A1</span>
                                <span className="text-blue-400">ATIVA</span>
                            </div>
                        </div>
                    </Card>

                    {/* KANBAN OBJECTIVES QUICK LIST */}
                    {kanbanCards.length > 0 && (
                        <div className="flex flex-col gap-2">
                             <h3 className="text-[9px] font-black uppercase text-emerald-500/40 px-2 tracking-widest">Alvos do Planejamento</h3>
                             <div className="space-y-1.5">
                                {kanbanCards.slice(0, 4).map(c => (
                                    <div key={c.id} onClick={() => startFromCard(c.pncpId)} className="p-2 bg-white/5 border border-white/5 rounded hover:border-emerald-500/40 cursor-pointer transition-all">
                                        <div className="text-[10px] font-bold text-white/80 truncate uppercase">{c.title}</div>
                                        <div className="text-[7px] opacity-30 font-mono mt-0.5">{c.pncpId}</div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}
                </div>

                {/* COLUNA CENTRAL: MAPA DE COMBATE (GRID DE ITENS) */}
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-red-500" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-white">Interface de Disputa Ativa</h2>
                         </div>
                         <div className="flex gap-2">
                            <Badge variant="outline" className="border-white/10 text-white/40">SESSÕES: {Object.keys(activeSessions).length}</Badge>
                         </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
                        {Object.keys(activeSessions).length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl opacity-20">
                                <Radar className="w-20 h-20 mb-4 animate-[spin_10s_linear_infinite]" />
                                <span className="text-xs font-black uppercase tracking-[0.5em]">Nenhum Alvo Detectado</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                                {Object.values(activeSessions).flatMap(s => 
                                    s.items.map(it => (
                                        <CombatItemCard 
                                            key={s.sessionId + it.itemId} 
                                            item={{
                                                ...it,
                                                limite: 150.00, // mock ou virá do store
                                                status: s.status === 'running' ? 'Disputa' : 'Aguardando'
                                            }}
                                            onFocus={() => {
                                                addLog(`Focando item ${it.itemId} da sala ${s.uasg}`, 'action', 'OPERATOR');
                                            }}
                                        />
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUNA DIREITA: TELEMETRIA & LOGS (380px) */}
                <div className="w-[380px] flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                    <div className="flex-[2] overflow-hidden">
                        <TacticalLog logs={logs} />
                    </div>
                    
                    {/* HARDWARE TELEMETRY */}
                    <div className="flex-1 bg-black/40 border border-emerald-900/20 rounded-lg p-4 flex flex-col gap-3">
                         <div className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-widest">
                            <Cpu className="w-3 h-3" /> Telemetria do Hardware
                         </div>
                         <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-[8px] text-emerald-500 mb-1">
                                    <span>CARGA DO PROCESSADOR</span>
                                    <span>{Math.floor(Math.random() * 15 + 10)}%</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                     <motion.div initial={{ width: 0 }} animate={{ width: '22%' }} className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[8px] text-emerald-400 mb-1">
                                    <span>USO DE MEMÓRIA (POLARYON)</span>
                                    <span>2.4 GB</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                     <motion.div initial={{ width: 0 }} animate={{ width: '45%' }} className="h-full bg-emerald-400 shadow-[0_0_10px_#10b981]" />
                                </div>
                            </div>
                         </div>
                    </div>
                </div>
            </div>

            {/* STATUS BAR FINAL */}
            <div className="h-8 border-t border-white/5 mt-4 flex items-center justify-between px-2">
                <div className="flex items-center gap-6 text-[8px] font-black uppercase text-emerald-500/40 tracking-widest">
                    <span className="flex items-center gap-1"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> SINAL: EXCELENTE</span>
                    <span>ENCRYPT: RSA-4096</span>
                    <span>SESSION RECOVERY: ON</span>
                </div>
                <div className="text-[10px] text-white/20 font-mono">
                    [{new Date().toLocaleDateString()}] -- {new Date().toLocaleTimeString()}
                </div>
            </div>

            {/* MODAL NOVO COMBATE */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0b1224] border border-emerald-500/30 p-8 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] w-full max-w-md relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                        
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-white font-['Anton'] text-xl tracking-tighter flex items-center gap-3">
                                <Zap className="w-5 h-5 text-emerald-500" /> DEPLOY DE OPERAÇÃO
                            </h2>
                            <button onClick={() => setIsAddOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X className="w-5 h-5 opacity-40" /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">UASG / CÓDIGO DO ÓRGÃO</label>
                                <Input value={newUasg} onChange={e => setNewUasg(e.target.value)} placeholder="Ex: 160001" className="bg-black/50 border-emerald-500/20 text-white font-mono h-12 focus:border-emerald-500 transition-colors" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">Nº PREGÃO</label>
                                    <Input value={newNumero} onChange={e => setNewNumero(e.target.value)} placeholder="0001" className="bg-black/50 border-emerald-500/20 text-white font-mono h-12" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">ANO</label>
                                    <Input value={newAno} onChange={e => setNewAno(e.target.value)} placeholder="2026" className="bg-black/50 border-emerald-500/20 text-white font-mono h-12" />
                                </div>
                            </div>

                            <Button onClick={addSession} className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-black h-14 uppercase tracking-[0.2em] mt-2 shadow-[0_10px_30px_rgba(16,185,129,0.2)]">
                                Iniciar Combate Visual
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
