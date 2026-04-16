import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Radar, 
    Target, 
    Zap, 
    AlertCircle, 
    ShieldCheck, 
    ArrowRight, 
    ExternalLink, 
    Clock, 
    DollarSign,
    Play,
    Bell,
    Settings,
    Search,
    MapPin,
    Building2,
    Shield,
    Plus,
    X,
    Filter
} from 'lucide-react';
import api from '@/lib/api';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogFooter 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { socketService } from '@/lib/socket';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PncpOpportunity {
    id: string;
    description: string;
    orgao: string;
    cnpjOrgao: string;
    ano: string;
    sequencial: string;
    valorEstimado: number;
    dataPublicacao: string;
    link: string;
    matchScore?: number;
}

const RadarScannerPage = () => {
    const [opportunities, setOpportunities] = useState<PncpOpportunity[]>([]);
    const [isScanning, setIsScanning] = useState(true);
    const [lastScan, setLastScan] = useState<Date>(new Date());
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    
    // Configurações do Radar
    const [keywords, setKeywords] = useState<string[]>([]);
    const [selectedStates, setSelectedStates] = useState<string[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const navigate = useNavigate();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Audio context for "Target Acquired" sound if no MP3 available
    const playTargetSound = useCallback(() => {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = context.createOscillator();
            const gain = context.createGain();
            
            osc.connect(gain);
            gain.connect(context.destination);
            
            // "Target Acquired" style beep sequences
            const now = context.currentTime;
            osc.type = 'square';
            
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            
            osc.frequency.setValueAtTime(1760, now + 0.15);
            gain.gain.setValueAtTime(0.1, now + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            
            osc.start(now);
            osc.stop(now + 0.3);
        } catch (e) {
            console.warn("Audio Context blocked", e);
        }
    }, []);

    // 📡 Busca configurações do Radar
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/radar/settings');
                setKeywords(res.data.keywords || []);
                setSelectedStates(res.data.states || []);
            } catch (error) {
                console.error('Falha ao carregar configurações do Radar:', error);
            }
        };
        fetchSettings();
    }, []);

    const saveSettings = async () => {
        setIsSaving(true);
        try {
            await api.post('/radar/settings', { keywords, states: selectedStates });
            toast.success('Radar Re-Calibrado!', {
                description: 'Os nichos e filtros foram atualizados com sucesso.',
                icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />
            });
            setIsSettingsOpen(false);
        } catch (error) {
            console.error('Erro ao salvar Radar:', error);
            toast.error('Falha ao calibrar Radar.');
        } finally {
            setIsSaving(false);
        }
    };

    const addKeyword = () => {
        if (!newKeyword.trim()) return;
        if (keywords.includes(newKeyword.trim())) return;
        setKeywords([...keywords, newKeyword.trim()]);
        setNewKeyword('');
    };

    const removeKeyword = (kw: string) => {
        setKeywords(keywords.filter(k => k !== kw));
    };

    const toggleState = (state: string) => {
        setSelectedStates(prev => 
            prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
        );
    };

    useEffect(() => {
        const handleRadarMatch = (data: any) => {
            if (data.type === 'PNCP_RADAR_MATCH' && data.data.opportunities) {
                const newOpps = data.data.opportunities as PncpOpportunity[];
                
                setOpportunities(prev => {
                    // Filter out duplicates
                    const existingIds = new Set(prev.map(o => o.id));
                    const uniqueNew = newOpps.filter(o => !existingIds.has(o.id));
                    return [...uniqueNew, ...prev].slice(0, 50); // Keep last 50
                });

                if (newOpps.length > 0) {
                    setLastScan(new Date());
                    if (notificationsEnabled) {
                        playTargetSound();
                        toast.success(`🎯 Radar: Encontradas ${newOpps.length} novas oportunidades!`, {
                            description: 'Engajamento rápido disponível.',
                            icon: <Target className="h-4 w-4 text-emerald-500" />
                        });
                    }
                }
            }
        };

        socketService.on('bidding_alert', handleRadarMatch);
        return () => {
            socketService.off('bidding_alert', handleRadarMatch);
        };
    }, [notificationsEnabled, playTargetSound]);

    const handleEngage = (opp: PncpOpportunity) => {
        // Redirect to Bidding Dashboard with pre-filled query params
        navigate(`/robo-lances?uasg=${opp.cnpjOrgao}&numero=${opp.sequencial}&ano=${opp.ano}&portal=compras_gov&autoConnect=true`);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6 min-h-screen bg-[#05070a] text-slate-100 overflow-hidden font-mono">
            {/* Header Radar */}
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-500/20 pb-6">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
                        <div className="relative p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                            <Radar className={cn("h-8 w-8 text-emerald-400", isScanning && "animate-[spin_4s_linear_infinite]")} />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tighter text-emerald-500">RADAR POLARYON</h1>
                        <p className="text-xs text-emerald-400/60 uppercase tracking-widest">Scanning PNCP: Dispensas Eletrônicas</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-emerald-500/5 border-emerald-500/20 text-emerald-400 flex gap-2 items-center py-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        PNCP MONITOR ATIVO
                    </Badge>
                    
                    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                        <DialogTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            >
                                <Settings className="h-4 w-4 mr-2" />
                                Configurar Nichos
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#0a0d14] border-slate-800 text-white max-w-2xl">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-emerald-500">
                                    <Target className="h-5 w-5" /> Calibração de Radar
                                </DialogTitle>
                            </DialogHeader>
                            
                            <div className="grid gap-6 py-4">
                                <div className="space-y-4">
                                    <Label className="text-slate-400 uppercase text-[10px] tracking-widest">Seus Nichos de Interesse (Palavras-Chave)</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="Ex: Arroz, Notebook, Papelaria..." 
                                            value={newKeyword}
                                            onChange={(e) => setNewKeyword(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                                            className="bg-slate-900 border-slate-800 text-white"
                                        />
                                        <Button onClick={addKeyword} className="bg-emerald-600 hover:bg-emerald-500">
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {keywords.map(kw => (
                                            <Badge key={kw} className="bg-slate-800 text-slate-200 border-none px-3 py-1 flex items-center gap-2">
                                                {kw}
                                                <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => removeKeyword(kw)} />
                                            </Badge>
                                        ))}
                                        {keywords.length === 0 && (
                                            <span className="text-xs text-slate-600 italic">Nenhum nicho configurado. O radar usará filtros genéricos.</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-slate-400 uppercase text-[10px] tracking-widest">Estados (UF)</Label>
                                    <div className="grid grid-cols-6 md:grid-cols-9 gap-2">
                                        {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                                            <div 
                                                key={uf}
                                                onClick={() => toggleState(uf)}
                                                className={cn(
                                                    "cursor-pointer border py-1 rounded text-center text-[10px] font-bold transition-all",
                                                    selectedStates.includes(uf) 
                                                        ? "bg-emerald-600 border-emerald-500 text-white" 
                                                        : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
                                                )}
                                            >
                                                {uf}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-600">Se nenhum estado for selecionado, o Radar buscará em todo o Brasil.</p>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button 
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold" 
                                    onClick={saveSettings}
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Calibrando...' : 'SALVAR CALIBRAÇÃO'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn(
                            "border-none transition-colors",
                            notificationsEnabled ? "text-emerald-500" : "text-slate-500"
                        )}
                        onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    >
                        {notificationsEnabled ? <Bell className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Lateral Stats */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-[#0a0d14] border-slate-800/50 shadow-2xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-slate-500 uppercase">Sistema de Escaneamento</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-400">Status</span>
                                <span className="text-sm text-emerald-400 font-bold">ATIVO</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-400">Visto hoje</span>
                                <span className="text-sm text-white font-bold">{opportunities.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-400">Última Varredura</span>
                                <span className="text-xs text-slate-500">{lastScan.toLocaleTimeString()}</span>
                            </div>
                            <div className="pt-4 border-t border-slate-800">
                                <div className="text-xs text-slate-500 mb-2 uppercase flex items-center gap-2">
                                    <Filter className="h-3 w-3" />
                                    {keywords.length > 0 ? 'Filtro: Nichos Personalizados' : 'Filtro: CNAEs da Empresa'}
                                </div>
                                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-emerald-500" 
                                        animate={{ width: ["0%", "100%"] }} 
                                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#0a0d14] border-slate-800/50">
                        <CardContent className="p-4 flex gap-4 items-center">
                            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-white uppercase">Modo Sniper Habilitado</h4>
                                <p className="text-[10px] text-slate-500">Alertas de lances críticos ativados conforme Stage 7.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Radar Feed */}
                <div className="lg:col-span-3">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                            <Search className="h-4 w-4" /> FEED DE OPORTUNIDADES EM TEMPO REAL
                        </h3>
                    </div>

                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                        <AnimatePresence mode="popLayout">
                            {opportunities.length === 0 ? (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-800 rounded-2xl bg-[#0a0d14]/30"
                                >
                                    <div className="relative mb-4">
                                        <Radar className="h-12 w-12 text-slate-700 animate-pulse" />
                                        <div className="absolute inset-0 animate-ping rounded-full border border-slate-700/50"></div>
                                    </div>
                                    <p className="text-slate-500 text-sm">Aguardando novas transmissões do PNCP...</p>
                                    <p className="text-[10px] text-slate-600 uppercase mt-2">O radar verifica a cada 5 minutos</p>
                                </motion.div>
                            ) : (
                                opportunities.map((opp) => (
                                    <motion.div
                                        key={opp.id}
                                        layout
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="group relative bg-[#0a0d14] border border-slate-800/50 hover:border-emerald-500/40 rounded-xl overflow-hidden transition-all duration-300"
                                    >
                                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50 group-hover:bg-emerald-500"></div>
                                        
                                        <div className="p-5 flex flex-col md:flex-row gap-6">
                                            <div className="flex-1 space-y-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-none">
                                                        DISPENSA ELETRÔNICA
                                                    </Badge>
                                                    <span className="text-[10px] text-slate-600 uppercase">UASG: {opp.cnpjOrgao} | {opp.sequencial}/{opp.ano}</span>
                                                </div>
                                                
                                                <h4 className="text-lg font-bold text-white leading-tight group-hover:text-emerald-400 transition-colors">
                                                    {opp.description}
                                                </h4>

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-2 text-[11px] text-slate-400 uppercase tracking-tight">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-3 w-3 text-slate-500" />
                                                        <span className="truncate max-w-[200px]">{opp.orgao}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="h-3 w-3 text-slate-500" />
                                                        <span>BRASIL (PNCP)</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <DollarSign className="h-3 w-3 text-emerald-500" />
                                                        <span className="text-emerald-400 font-bold">{formatCurrency(opp.valorEstimado)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col justify-between gap-4 md:w-32">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] text-slate-600 uppercase">Publicado</span>
                                                    <span className="text-xs text-slate-300 flex items-center gap-1 font-bold">
                                                        <Clock className="h-3 w-3" /> {formatDate(opp.dataPublicacao)}
                                                    </span>
                                                </div>

                                                <Button 
                                                    size="sm"
                                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-[0_0_15px_-5px_rgba(16,185,129,0.5)] flex gap-2"
                                                    onClick={() => handleEngage(opp)}
                                                >
                                                    <Target className="h-4 w-4" /> ENGAJAR
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Footer Stats Strip */}
            <div className="mt-auto pt-6 border-t border-slate-800/50 flex flex-wrap items-center justify-between gap-4 text-[10px] text-slate-600 uppercase tracking-[0.2em]">
                <div className="flex gap-6">
                    <span className="flex items-center gap-2"><Zap className="h-3 w-3 text-yellow-500" /> PNCP SYNC OK</span>
                    <span className="flex items-center gap-2"><Shield className="h-3 w-3 text-blue-500" /> ENCRYPTION ACTIVE</span>
                </div>
                <div>POLARYON KUNBUN // OPS_RADAR_V1.0</div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #10b981;
                }
            `}} />
        </div>
    );
};

export default RadarScannerPage;
