import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    TrendingUp, Zap, Calendar, MapPin, Building2, 
    DollarSign, Search, Filter, Loader2, AlertCircle, 
    ChevronRight, ExternalLink, KanbanSquare, ArrowUpRight,
    Briefcase, ShieldCheck, Info
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const ESTADOS_BR = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

interface Convenio {
    id: number;
    numero: string;
    objeto: string;
    valor: number;
    dataInicio: string;
    dataFim: string;
    concedente: string;
    convenente: string;
    cnpjConvenente: string;
    uf: string;
    municipio: string;
    situacao: string;
    statusPredicao: string;
}

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
        const [year, month, day] = dateString.split('-');
        if (day && month && year) return `${day}/${month}/${year}`;
        const d = new Date(dateString);
        return d.toLocaleDateString('pt-BR');
    } catch {
        return dateString;
    }
};

const InteligenciaPreditiva: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<Convenio[]>([]);
    const [ufFilter, setUfFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [searchTerm, setSearchTerm] = useState('');

    const fetchConvenios = useCallback(async () => {
        setLoading(true);
        try {
            // Converter YYYY-MM para datas de início e fim do mês no formato dd/mm/aaaa
            const [year, month] = monthFilter.split('-');
            const firstDay = `01/${month}/${year}`;
            const lastDayDate = new Date(parseInt(year), parseInt(month), 0);
            const lastDay = `${String(lastDayDate.getDate()).padStart(2, '0')}/${month}/${year}`;

            const response = await api.get('/transferegov/convenios', {
                params: {
                    dataInicial: firstDay,
                    dataFinal: lastDay,
                    uf: ufFilter || undefined
                }
            });

            if (response.data.success) {
                setItems(response.data.items);
            }
        } catch (error) {
            console.error('Fetch Convenios Error:', error);
            toast.error("Erro ao carregar dados do Transferegov.");
        } finally {
            setLoading(false);
        }
    }, [monthFilter, ufFilter]);

    useEffect(() => {
        fetchConvenios();
    }, [fetchConvenios]);

    const filteredItems = items.filter(item => 
        item.objeto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.convenente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.numero.includes(searchTerm)
    );

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 min-h-screen bg-background/50">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight">Radar de Investimentos</h2>
                    </div>
                    <p className="text-muted-foreground">
                        Inteligência Preditiva: Monitore repasses e convênios federais antes da abertura de licitações.
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <Zap className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Feed em Tempo Real</span>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm space-y-2"
                >
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                        <DollarSign className="w-3.5 h-3.5" />
                        Volume Mapeado no Mês
                    </div>
                    <div className="text-2xl font-bold text-primary">
                        {formatCurrency(items.reduce((acc, i) => acc + i.valor, 0))}
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm space-y-2"
                >
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                        <Building2 className="w-3.5 h-3.5" />
                        Órgãos em Captação
                    </div>
                    <div className="text-2xl font-bold">
                        {new Set(items.map(i => i.convenente)).size} Municipios/Entidades
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm space-y-2"
                >
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        Leads de Alta Probabilidade
                    </div>
                    <div className="text-2xl font-bold text-emerald-500">
                        {items.length} Oportunidades Próximas
                    </div>
                </motion.div>
            </div>

            {/* Filter Section */}
            <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-md">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="text" 
                            placeholder="Buscar por objeto, convenente ou número..."
                            className="w-full h-10 pl-10 pr-4 bg-background/50 border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <select 
                            className="w-full h-10 pl-10 pr-4 bg-background/50 border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none appearance-none"
                            value={ufFilter}
                            onChange={(e) => setUfFilter(e.target.value)}
                        >
                            <option value="">Brasil (Todos)</option>
                            {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                    </div>

                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="month"
                            className="w-full h-10 pl-10 pr-4 bg-background/50 border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Items Table/Grid */}
            <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground animate-pulse font-medium">Sincronizando com Transferegov Nacional...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <AlertCircle className="w-10 h-10 text-muted-foreground/30" />
                        <div className="text-center">
                            <p className="font-semibold text-muted-foreground uppercase tracking-widest text-xs">Nenhum investimento mapeado</p>
                            <p className="text-sm text-muted-foreground/60">Tente alterar o período ou o estado.</p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground tracking-widest border-b border-border">
                                    <th className="px-6 py-4">Status Polaryon</th>
                                    <th className="px-6 py-4">Convenente / Órgão</th>
                                    <th className="px-6 py-4">Objeto do Investimento</th>
                                    <th className="px-6 py-4">Valor Repassado</th>
                                    <th className="px-6 py-4">Vigência</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredItems.map((item) => (
                                    <motion.tr 
                                        key={item.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="group hover:bg-muted/30 transition-colors cursor-default"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit">
                                                    <Zap className="w-3 h-3" />
                                                    PREDITIVO: ALTA
                                                </div>
                                                <span className="text-[10px] text-muted-foreground pl-1">{item.situacao}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="font-bold text-sm tracking-tight">{item.convenente}</div>
                                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                    <MapPin className="w-3 h-3" />
                                                    {item.municipio} - {item.uf}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-md">
                                            <div className="text-xs text-foreground/80 line-clamp-2 leading-relaxed italic">
                                                "{item.objeto}"
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-primary text-sm">
                                                {formatCurrency(item.valor)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-1 rounded w-fit">
                                                <Clock className="w-3 h-3" />
                                                Até {formatDate(item.dataFim)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => toast.success("Lead enviado ao funil de Pré-Venda!")}
                                                    className="p-2 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition-all"
                                                    title="Tornar Lead (Enviar ao Kanban)"
                                                >
                                                    <KanbanSquare className="w-4 h-4" />
                                                </button>
                                                <button className="p-2 hover:bg-muted text-muted-foreground rounded-lg transition-all">
                                                    <Info className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Bottom Tip */}
            <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                <ArrowUpRight className="w-5 h-5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">
                    <span className="font-bold text-primary uppercase">Dica de Inteligência:</span> Convênios são registrados quando o recurso é liberado. 
                    Mantenha o radar ativo para abordar o órgão ou preparar o estoque dos itens mapeados no objeto antes que o edital seja publicado no PNCP.
                </p>
            </div>
        </div>
    );
};

export default InteligenciaPreditiva;

const Clock: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
