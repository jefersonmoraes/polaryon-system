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
import { useBiddingStore } from '@/store/bidding-store';

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
    const { 
        sessions, 
        activeSessionId, 
        globalStats,
        addSession, 
        updateSessionItems, 
        updateSessionStatus, 
        addSessionLog, 
        setActiveSession, 
        removeSession 
    } = useBiddingStore();

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newUasg, setNewUasg] = useState('');
    const [newNumero, setNewNumero] = useState('');
    const [newAno, setNewAno] = useState(new Date().getFullYear().toString());
    const [isElectron] = useState(!!(window as any).electronAPI);
    const [kanbanCards, setKanbanCards] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    const activeSession = activeSessionId ? sessions[activeSessionId] : null;

    const addLog = (sid: string, message: string, level: 'info' | 'action' | 'threat' | 'success' = 'info', source?: string) => {
      addSessionLog(sid, {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
        source
      });
    };

    // Preload Kanban Objectives
    useEffect(() => {
        if (isAddOpen) {
            api.get('/kanban/board').then(res => {
                if (res.data.success && res.data.board) {
                    const cards: any[] = [];
                    res.data.board.lists.forEach((l: any) => l.cards.forEach((c: any) => {
                        if (c.pncpId) cards.push(c);
                    }));
                    setKanbanCards(cards);
                }
            }).catch(console.error);
        }
    }, [isAddOpen]);

    // Electron IPC Handling
    useEffect(() => {
        if (isElectron && (window as any).electronAPI) {
            const handleUpdate = (data: any) => {
                updateSessionItems(data.sessionId, data.items);
                
                // Logs inteligentes
                data.items.forEach((it: any) => {
                   if (it.ganhador === 'Você' && it.status === 'Disputa') {
                      addLog(data.sessionId, `ITEM ${it.itemId}: Você assumiu o primeiro lugar!`, 'success', `SALA ${data.uasg}`);
                   }
                });
            };

            const handleError = (data: any) => {
                updateSessionStatus(data.sessionId, 'error');
                addLog(data.sessionId, `ERRO: ${data.error}`, 'threat', 'SYSTEM');
                toast.error(`Falha na sessão ${data.sessionId}: ${data.error}`);
            };

            const unsub = (window as any).electronAPI.onBiddingUpdate(handleUpdate);
            return () => { if (unsub) unsub(); };
        }
    }, [isElectron]);

    const deploySession = async () => {
        if (!newUasg || !newNumero) {
            toast.error("Preencha UASG e Número");
            return;
        }

        try {
            const res = await api.post('/bidding/sessions', { uasg: newUasg, numeroPregao: newNumero, anoPregao: newAno, portal: 'compras_gov' });
            if (res.data.success) {
                const session = res.data.session;
                addSession({ sessionId: session.id, uasg: newUasg, numero: newNumero, ano: newAno });
                
                if (isElectron) {
                    (window as any).electronAPI.startVisualBidding({ 
                        sessionId: session.id, 
                        uasg: newUasg, 
                        numero: newNumero, 
                        ano: newAno, 
                        vault: {} 
                    });
                }
                
                addLog(session.id, `Iniciando combate na UASG ${newUasg} - Edital ${newNumero}/${newAno}`, 'action', 'DEPLOY');
                setIsAddOpen(false);
                setNewUasg('');
                setNewNumero('');
            }
        } catch (e) {
            toast.error("Erro ao criar sala de combate");
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#020617] text-emerald-500 font-mono flex flex-col select-none overflow-hidden">
            {/* TOP COMMAND BAR */}
            <div className="h-14 bg-black/60 border-b border-emerald-500/20 flex items-center justify-between px-6 backdrop-blur-md z-30">
                <div className="flex items-center gap-6">
                    <h1 className="text-xl font-['Anton'] tracking-tighter text-white uppercase italic">Polaryon <span className="text-emerald-500">Terminal</span></h1>
                    <div className="h-8 w-[1px] bg-white/10" />
                    <div className="flex gap-4">
                        <div className="flex flex-col">
                            <span className="text-[7px] text-white/40 uppercase font-black">Ganho Estimado</span>
                            <span className="text-sm font-bold text-emerald-400">R$ {globalStats.totalValue.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[7px] text-white/40 uppercase font-black">Itens Liderando</span>
                            <span className="text-sm font-bold text-white">{globalStats.winning}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Button 
                        size="sm"
                        onClick={() => setIsAddOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase text-[10px] h-8 px-4"
                    >
                        <Plus className="w-3 h-3 mr-2" /> Novo Desdobramento
                    </Button>
                    <div className="flex bg-white/5 rounded-md p-1 border border-white/10">
                         <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-sm transition-all ${viewMode === 'grid' ? 'bg-emerald-500 text-black' : 'text-white/40 hover:text-white'}`}><Monitor className="w-3.5 h-3.5"/></button>
                         <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-sm transition-all ${viewMode === 'table' ? 'bg-emerald-500 text-black' : 'text-white/40 hover:text-white'}`}><ListFilter className="w-3.5 h-3.5"/></button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* SIDEBAR DE MISSÕES (MULTI-SESSÃO) */}
                <div className="w-[280px] bg-black/40 border-r border-white/5 flex flex-col">
                    <div className="p-4 border-b border-white/5 bg-emerald-500/5">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 flex items-center gap-2">
                             <Radar className="w-3 h-3" /> Radar de Operações
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {Object.values(sessions).length === 0 ? (
                            <div className="p-10 text-center opacity-20 mt-10">
                                <Activity className="w-8 h-8 mx-auto mb-2" />
                                <span className="text-[8px] font-bold uppercase block">Vazio</span>
                            </div>
                        ) : (
                            Object.values(sessions).map(s => (
                                <div 
                                    key={s.sessionId}
                                    onClick={() => setActiveSession(s.sessionId)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all group ${
                                        activeSessionId === s.sessionId 
                                        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                        : 'bg-white/5 border-transparent hover:border-white/10'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[11px] font-['Anton'] text-white">UASG {s.uasg}</span>
                                        <Badge variant="outline" className={`text-[7px] border-none px-1 h-3 ${
                                            s.status === 'running' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/10 text-white/40'
                                        }`}>
                                            {s.status.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] opacity-40">Edital {s.numero}/{s.ano}</span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeSession(s.sessionId); if (isElectron) (window as any).electronAPI.stopVisualBidding(s.sessionId); }} 
                                            className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-1 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    {s.items.length > 0 && (
                                        <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500" style={{ width: `${(s.items.filter(i => i.ganhador === 'Você').length / s.items.length) * 100}%` }} />
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* VISUALIZAÇÃO DA MISSÃO ATIVA */}
                <div className="flex-1 flex flex-col bg-[#020617] relative">
                    {activeSession ? (
                        <div className="flex-1 flex overflow-hidden">
                            {/* ÁREA DE COMBATE */}
                            <div className="flex-1 flex flex-col p-6 overflow-hidden">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                            <Target className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-['Anton'] text-white tracking-tight">DISPUTA UASG {activeSession.uasg}</h2>
                                            <p className="text-[9px] text-white/40 font-black tracking-widest uppercase italic">Engajamento em Tempo Real - Portal Compras.gov.br</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-4">
                                        <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg flex flex-col gap-0.5">
                                            <span className="text-[7px] opacity-40 uppercase font-black">Itens na Sala</span>
                                            <span className="text-sm font-bold text-white">{activeSession.items.length} ITENS</span>
                                        </div>
                                        <Button 
                                            variant="destructive" 
                                            size="sm" 
                                            onClick={() => removeSession(activeSession.sessionId)}
                                            className="h-full bg-red-950/40 border border-red-500/20 hover:bg-red-900/60 text-red-500 text-[10px] font-black uppercase"
                                        >
                                            Encerrar Missão
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
                                    {activeSession.items.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl opacity-20">
                                            <Radar className="w-20 h-20 mb-4 animate-[spin_10s_linear_infinite]" />
                                            <span className="text-xs font-black uppercase tracking-[0.5em]">Sincronizando Sessão...</span>
                                        </div>
                                    ) : (
                                        viewMode === 'grid' ? (
                                            <div className="grid grid-cols-1 2xl:grid-cols-2 3xl:grid-cols-3 gap-4">
                                                {activeSession.items.map(it => (
                                                    <CombatItemCard 
                                                        key={activeSession.sessionId + it.itemId} 
                                                        item={{
                                                            ...it,
                                                            limite: 0, // Pegar do store real se houver
                                                            status: it.status as any
                                                        }}
                                                        onFocus={() => {
                                                            addLog(activeSession.sessionId, `COMANDO: Focando item ${it.itemId}`, 'action', 'OPERATOR');
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-black/40 border border-white/5 rounded-xl overflow-hidden">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-emerald-500/5 text-[9px] font-black uppercase tracking-widest border-b border-white/10">
                                                            <th className="p-4">Item</th>
                                                            <th className="p-4">Descrição</th>
                                                            <th className="p-4">Valor Atual</th>
                                                            <th className="p-4">Status</th>
                                                            <th className="p-4 text-right">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {activeSession.items.map(it => (
                                                            <tr key={it.itemId} className="hover:bg-white/5 transition-colors group">
                                                                <td className="p-4 font-bold text-emerald-500">#{it.itemId}</td>
                                                                <td className="p-4 text-[10px] text-white/60 max-w-[300px] truncate">{it.descricao || 'Item em disputa no portal'}</td>
                                                                <td className="p-4">
                                                                    <div className="flex flex-col">
                                                                        <span className={`text-sm font-bold ${it.ganhador === 'Você' ? 'text-emerald-400' : 'text-white'}`}>
                                                                            R$ {it.valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                        <span className="text-[7px] opacity-30 uppercase font-black">{it.ganhador}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <Badge className={it.status === 'Disputa' ? 'bg-emerald-500/20 text-emerald-500 border-none' : 'bg-white/10 text-white/40 border-none'}>
                                                                        {it.status.toUpperCase()}
                                                                    </Badge>
                                                                </td>
                                                                <td className="p-4 text-right">
                                                                     <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black hover:bg-emerald-500 hover:text-black">GATILHO</Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* TELEMETRIA & LOGS DA SESSÃO ATIVA */}
                            <div className="w-[380px] border-l border-white/5 flex flex-col bg-black/20 backdrop-blur-sm">
                                <TacticalLog logs={activeSession.logs} />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                            <div className="w-32 h-32 rounded-full border border-emerald-500/10 flex items-center justify-center mb-10 relative">
                                <Radar className="w-12 h-12 text-emerald-500 opacity-20 animate-pulse" />
                                <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-full animate-ping" />
                            </div>
                            <h2 className="text-3xl font-['Anton'] text-white/20 mb-4 tracking-tighter">CENTRO DE COMANDO POLARYON</h2>
                            <p className="text-sm text-emerald-500/20 font-black tracking-widest uppercase">Selecione uma missão no radar lateral ou inicie um novo desdobramento</p>
                        </div>
                    )}
                </div>
            </div>

            {/* STATUS BAR FINAL */}
            <div className="h-10 bg-black/80 border-t border-emerald-500/10 flex items-center justify-between px-6 z-40">
                <div className="flex items-center gap-6 text-[9px] font-black uppercase text-emerald-500/40 tracking-widest">
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" /> GATEWAY STATUS: ONLINE</span>
                    <span className="flex items-center gap-2"><Cpu className="w-3 h-3" /> LATÊNCIA: 28MS</span>
                    <span className="flex items-center gap-2"><Shield className="w-3 h-3" /> SECURITY: RSA-X8</span>
                </div>
                <div className="text-[10px] text-white/20 font-mono italic">
                    POLARYON v3.0 // OPERAÇÃO INFILTRADO // {new Date().toLocaleTimeString()}
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

                            <Button onClick={deploySession} className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-black h-14 uppercase tracking-[0.2em] mt-2 shadow-[0_10px_30px_rgba(16,185,129,0.2)]">
                                Iniciar Operação Visual
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
