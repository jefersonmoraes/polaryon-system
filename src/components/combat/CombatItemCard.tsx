import React from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingDown, Shield, Zap, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface CombatItem {
    itemId: string;
    valorAtual: number;
    meuLance?: number;
    limite: number;
    status: 'Disputa' | 'Encerrado' | 'Aguardando';
    ganhador: string;
    descricao?: string;
}

interface CombatItemCardProps {
    item: CombatItem;
    onFocus?: () => void;
    onAbandon?: () => void;
}

export const CombatItemCard: React.FC<CombatItemCardProps> = ({ item, onFocus, onAbandon }) => {
    // Cálculo de "Distância de segurança"
    const safetyPercent = item.valorAtual > 0 
        ? Math.max(0, Math.min(100, ((item.valorAtual - item.limite) / item.valorAtual) * 100))
        : 100;
        
    const isLosing = item.ganhador !== 'Você';
    const isNearLimit = safetyPercent < 15;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative group bg-[#0b101e]/80 border rounded-xl overflow-hidden transition-all ${
                isLosing ? 'border-red-500/20 hover:border-red-500/40' : 'border-emerald-500/20 hover:border-emerald-500/40'
            }`}
        >
            {/* Status Header Area */}
            <div className={`px-4 py-2 border-b flex justify-between items-center ${
                isLosing ? 'bg-red-500/5 border-red-500/10' : 'bg-emerald-500/5 border-emerald-500/10'
            }`}>
                <div className="flex items-center gap-2">
                    <Target className={`w-3 h-3 ${isLosing ? 'text-red-500' : 'text-emerald-500'}`} />
                    <span className="text-[10px] font-black uppercase tracking-tighter text-white/80">Item {item.itemId}</span>
                </div>
                <Badge variant="outline" className={`text-[8px] font-bold border-none uppercase px-2 ${
                    isLosing ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'
                }`}>
                    {isLosing ? 'Perdendo' : 'Ganhando'}
                </Badge>
            </div>

            {/* Main Data Panel */}
            <div className="p-4 flex flex-col gap-4">
                <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-white/40 uppercase font-black tracking-widest">Valor Atual</span>
                        <span className={`text-xl font-['Anton'] tracking-tighter transition-colors ${
                            isLosing ? 'text-white' : 'text-emerald-400'
                        }`}>
                            R$ {item.valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] text-white/40 uppercase font-black tracking-widest">Meu Limite</span>
                        <span className="text-sm font-mono font-bold text-white/70">R$ {item.limite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                {/* Safety Gauge */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                        <span className="opacity-50">Margem de Manobra</span>
                        <span className={isNearLimit ? 'text-red-500 animate-pulse' : 'text-emerald-400'}>{safetyPercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={safetyPercent} className={`h-1.5 bg-white/5 ${
                        isNearLimit ? 'indicator-red' : 'indicator-emerald'
                    }`} />
                </div>

                {/* Tactical Context */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 p-2 rounded flex items-center gap-2 border border-white/5">
                        <Clock className="w-3 h-3 opacity-30" />
                        <div className="flex flex-col">
                            <span className="text-[7px] opacity-40 uppercase">Fase</span>
                            <span className="text-[9px] font-bold text-white">{item.status.toUpperCase()}</span>
                        </div>
                    </div>
                    <div className="bg-white/5 p-2 rounded flex items-center gap-2 border border-white/5">
                        <TrendingDown className="w-3 h-3 opacity-30" />
                        <div className="flex flex-col">
                            <span className="text-[7px] opacity-40 uppercase">Ganhador</span>
                            <span className="text-[9px] font-bold text-white/80">{item.ganhador}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="px-2 pb-2 grid grid-cols-2 gap-2">
                <Button 
                    onClick={onFocus}
                    variant="outline" 
                    className="h-8 text-[9px] font-black bg-white/5 border-white/10 hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all uppercase"
                >
                    <Zap className="w-3 h-3 mr-1" /> Forçar Lance
                </Button>
                <Button 
                    onClick={onAbandon}
                    variant="outline" 
                    className="h-8 text-[9px] font-black bg-white/5 border-white/10 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all uppercase"
                >
                    <Shield className="w-3 h-3 mr-1" /> Abandonar
                </Button>
            </div>

            <style>{`
                .indicator-emerald [role=progressbar] { background: #10b981 !important; }
                .indicator-red [role=progressbar] { background: #ef4444 !important; }
            `}</style>
        </motion.div>
    );
};
