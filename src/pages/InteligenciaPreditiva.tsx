import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    TrendingUp, Zap, Calendar, MapPin, Building2, 
    DollarSign, Search, Filter, Loader2, AlertCircle, 
    ChevronRight, ExternalLink, KanbanSquare, ArrowUpRight,
    Briefcase, ShieldCheck, Info, X, Clock, FileText, ChevronDown, ListFilter
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const ESTADOS_BR = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

interface Convenio {
    id: number;
    numero: string;
    objeto: string;
    valor: number;
    valorLiberado?: number;
    valorContrapartida?: number;
    dataInicio: string;
    dataFim: string;
    concedente: string;
    orgaoVinculado?: string;
    convenente: string;
    cnpjConvenente: string;
    uf: string;
    municipio: string;
    situacao: string;
    statusPredicao: string;
    processo?: string;
    tipoInstrumento?: string;
    funcao?: string;
    subfuncao?: string;
}

interface TipoInstrumento {
    codigo: string;
    descricao: string;
}

const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'N/I';
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
    const [fetchingMore, setFetchingMore] = useState(false);
    const [items, setItems] = useState<Convenio[]>([]);
    const [pagina, setPagina] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    
    // Filtros
    const [ufFilter, setUfFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [valorMin, setValorMin] = useState('');
    const [valorMax, setValorMax] = useState('');
    const [tipoFilter, setTipoFilter] = useState('');
    const [tiposOptions, setTiposOptions] = useState<TipoInstrumento[]>([]);
    
    // Modal de Detalhes
    const [selectedConvenio, setSelectedConvenio] = useState<Convenio | null>(null);

    const fetchTipos = useCallback(async () => {
        try {
            const resp = await api.get('/transferegov/tipo-instrumento');
            setTiposOptions(resp.data);
        } catch (e) { console.error('Erro ao buscar tipos', e); }
    }, []);

    const fetchConvenios = useCallback(async (p = 1, append = false) => {
        if (append) setFetchingMore(true); else setLoading(true);
        try {
            const [year, month] = monthFilter.split('-');
            const firstDay = `01/${month}/${year}`;
            const lastDayDate = new Date(parseInt(year), parseInt(month), 0);
            const lastDay = `${String(lastDayDate.getDate()).padStart(2, '0')}/${month}/${year}`;

            const response = await api.get('/transferegov/convenios', {
                params: {
                    pagina: p,
                    dataInicial: firstDay,
                    dataFinal: lastDay,
                    uf: ufFilter || undefined,
                    valorMin: valorMin || undefined,
                    valorMax: valorMax || undefined,
                    tipoInstrumento: tipoFilter || undefined
                }
            });

            if (response.data.success) {
                const newItems = response.data.items || [];
                if (append) {
                    setItems(prev => [...prev, ...newItems]);
                } else {
                    setItems(newItems);
                }
                setHasMore(newItems.length >= 15);
            }
        } catch (error) {
            console.error('Fetch Convenios Error:', error);
            toast.error("Erro ao carregar dados do Transferegov.");
        } finally {
            setLoading(false);
            setFetchingMore(false);
        }
    }, [monthFilter, ufFilter, valorMin, valorMax, tipoFilter]);

    // Reset ao mudar filtros base
    useEffect(() => {
        setPagina(1);
        fetchConvenios(1, false);
    }, [fetchConvenios]);

    useEffect(() => {
        fetchTipos();
    }, [fetchTipos]);

    const handleLoadMore = () => {
        const next = pagina + 1;
        setPagina(next);
        fetchConvenios(next, true);
    };

    const filteredItems = (items || []).filter(item => {
        if (!item) return false;
        const search = searchTerm.toLowerCase();
        const objeto = String(item.objeto || '').toLowerCase();
        const convenente = String(item.convenente || '').toLowerCase();
        const numero = String(item.numero || '').toLowerCase();
        return objeto.includes(search) || convenente.includes(search) || numero.includes(search);
    });

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
                    <p className="text-muted-foreground text-sm">
                        Plataforma Preditiva: Antecipe oportunidades mapeando repasses federais e convênios em tempo real.
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <Zap className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Monitorando Dados Abertos</span>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm space-y-1"
                >
                    <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                        <DollarSign className="w-3 h-3" /> Volume Investido
                    </div>
                    <div className="text-xl font-bold text-primary">
                        {formatCurrency((items || []).reduce((acc, i) => acc + (i?.valor || 0), 0))}
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                    className="p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm space-y-1"
                >
                    <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                        <Building2 className="w-3 h-3" /> Entidades Ativas
                    </div>
                    <div className="text-xl font-bold">
                        {new Set((items || []).map(i => i?.convenente || 'Indefinido')).size} Unidades
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                    className="p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm space-y-1"
                >
                    <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                        <Zap className="w-3 h-3 text-emerald-500" /> Leads Preditivos
                    </div>
                    <div className="text-xl font-bold text-emerald-500">
                        {(items || []).length} Mapeados
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                    className="p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm space-y-1"
                >
                    <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                        <Calendar className="w-3 h-3" /> Janela de Captura
                    </div>
                    <div className="text-xl font-bold italic">
                        {monthFilter.split('-').reverse().join('/')}
                    </div>
                </motion.div>
            </div>

            {/* Comprehensive Filter Section */}
            <div className="p-5 rounded-xl border border-border bg-card/60 backdrop-blur-md space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                    <ListFilter className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-widest">Filtros Avançados de Busca Profunda</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground pl-1">Busca Textual</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input 
                                type="text" 
                                placeholder="Objeto, Entidade ou Convênio..."
                                className="w-full h-9 pl-9 pr-4 bg-background/50 border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground pl-1">Estado (UF)</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                            <Select 
                                value={ufFilter || 'all'} 
                                onValueChange={(v) => setUfFilter(v === 'all' ? '' : v)}
                            >
                                <SelectTrigger className="w-full h-9 pl-9 bg-background/50 border-border text-xs font-bold shadow-sm">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                    <SelectItem value="all" className="text-xs font-bold">Todos</SelectItem>
                                    {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf} className="text-xs font-bold">{uf}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground pl-1">Mês de Registro</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input 
                                type="month"
                                className="w-full h-9 pl-9 pr-4 bg-background/50 border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary outline-none"
                                value={monthFilter}
                                onChange={(e) => setMonthFilter(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground pl-1">Valor Mínimo</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input 
                                type="number"
                                placeholder="Min R$"
                                className="w-full h-9 pl-9 pr-4 bg-background/50 border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary outline-none"
                                value={valorMin}
                                onChange={(e) => setValorMin(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground pl-1">Tipo de Instrumento</label>
                        <Select 
                            value={tipoFilter || 'all'} 
                            onValueChange={(v) => setTipoFilter(v === 'all' ? '' : v)}
                        >
                            <SelectTrigger className="w-full h-9 bg-background/50 border-border text-xs font-bold shadow-sm">
                                <SelectValue placeholder="Todos Tipos" />
                            </SelectTrigger>
                            <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                <SelectItem value="all" className="text-xs font-bold">Todos Tipos</SelectItem>
                                {tiposOptions.map(t => (
                                    <SelectItem key={t.codigo} value={t.codigo} className="text-xs font-bold">
                                        {t.descricao}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Main Table Interface */}
            <div className="rounded-xl border border-border bg-card/30 overflow-hidden min-h-[400px]">
                {loading && pagina === 1 ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <div className="text-center">
                            <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Varredura Transferegov em Andamento</p>
                            <p className="text-[10px] text-muted-foreground font-mono">Conectando ao barramento de dados federal...</p>
                        </div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-3 opacity-50">
                        <AlertCircle className="w-12 h-12" />
                        <div className="text-center">
                            <p className="font-bold uppercase tracking-[0.2em] text-xs">Nenhum investimento detectado</p>
                            <p className="text-[10px] text-muted-foreground">Tente suavizar os filtros ou mudar o período de busca.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/40 text-[10px] uppercase font-black text-muted-foreground/80 tracking-[0.15em] border-b border-border">
                                        <th className="px-6 py-5">Probabilidade Polaryon</th>
                                        <th className="px-6 py-5">Entidade Convenente</th>
                                        <th className="px-6 py-5">Objeto e Finalidade</th>
                                        <th className="px-6 py-5">Valor Global</th>
                                        <th className="px-6 py-5">Fonte Ministerial</th>
                                        <th className="px-6 py-5 text-right">Ficha Técnica</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    <AnimatePresence mode="popLayout">
                                    {filteredItems.map((item, idx) => (
                                        <motion.tr 
                                            key={`${item.id}-${idx}`}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: (idx % 15) * 0.02 }}
                                            className="group hover:bg-primary/5 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-black w-fit uppercase">
                                                        <Zap className="w-2.5 h-2.5" /> Preditivo: Alta
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground/70 pl-0.5 truncate max-w-[120px]">{item.situacao}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-0.5">
                                                    <div className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors">{item.convenente}</div>
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium uppercase">
                                                        <MapPin className="w-2.5 h-2.5" />
                                                        {item.municipio} - {item.uf}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-sm">
                                                <div className="text-[11px] text-foreground/80 line-clamp-2 leading-relaxed italic border-l border-primary/20 pl-2">
                                                    "{item.objeto}"
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-black text-primary text-sm">
                                                    {formatCurrency(item.valor)}
                                                </div>
                                                <div className="text-[9px] text-muted-foreground font-bold uppercase mt-1">
                                                    {item.tipoInstrumento}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-muted-foreground truncate max-w-[160px]">{item.concedente}</span>
                                                    <span className="text-[9px] text-primary/60 font-semibold uppercase">{item.funcao}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => setSelectedConvenio(item)}
                                                        className="p-2 hover:bg-primary/20 text-primary border border-primary/20 rounded shadow-sm transition-all group/btn"
                                                        title="Raio-X: Ficha Técnica"
                                                    >
                                                        <FileText className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                    <button 
                                                        onClick={() => toast.success("Oportunidade salva em Pré-Venda!")}
                                                        className="p-2 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 rounded shadow-sm transition-all"
                                                        title="Capturar Lead"
                                                    >
                                                        <KanbanSquare className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Pagination / Load More */}
                        <div className="p-8 flex flex-col items-center justify-center border-t border-border bg-muted/10">
                            {hasMore ? (
                                <button 
                                    onClick={handleLoadMore}
                                    disabled={fetchingMore}
                                    className="flex items-center gap-3 px-12 py-3 bg-primary text-primary-foreground rounded-full font-bold uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-primary/20"
                                >
                                    {fetchingMore ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Varrendo Próxima Página...
                                        </>
                                    ) : (
                                        <>
                                            Carregar Tudo (Próxima Página)
                                            <ChevronDown className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
                                    Fim da Lista de Investimentos Disponíveis
                                </div>
                            )}
                            <p className="text-[9px] text-muted-foreground mt-4 font-mono">
                                Mostrando {items.length} convênios mapeados na janela de {monthFilter}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Ficha Técnica Profunda */}
            <Dialog open={!!selectedConvenio} onOpenChange={() => setSelectedConvenio(null)}>
                <DialogContent className="max-w-3xl bg-background/95 backdrop-blur-md border-border shadow-2xl">
                    <DialogHeader className="border-b border-border pb-4 mb-4">
                        <div className="flex items-center gap-2 text-primary mb-1">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Raio-X de Investimento Público</span>
                        </div>
                        <DialogTitle className="text-xl font-bold tracking-tight leading-tight">
                            {selectedConvenio?.convenente}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-mono uppercase">
                            Convênio Nº {selectedConvenio?.numero} | Processo {selectedConvenio?.processo}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="p-4 bg-muted/40 rounded-xl space-y-3">
                                <h4 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-primary/20 pb-1">Engenharia Financeira</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Valor Global</p>
                                        <p className="text-lg font-black text-primary">{formatCurrency(selectedConvenio?.valor)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Repasse Liberado</p>
                                        <p className="text-lg font-bold text-emerald-500">{formatCurrency(selectedConvenio?.valorLiberado)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Contrapartida Munic.</p>
                                        <p className="text-md font-bold">{formatCurrency(selectedConvenio?.valorContrapartida)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Situação Atual</p>
                                        <p className="text-[10px] font-bold p-1 bg-background border border-border rounded text-center">{selectedConvenio?.situacao}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border border-border rounded-xl space-y-2">
                                <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Localização Analítico</h4>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-bold">{selectedConvenio?.municipio} - {selectedConvenio?.uf}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium">CNPJ Convenente: {selectedConvenio?.cnpjConvenente}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 border border-border rounded-xl space-y-3">
                                <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Escopo do Investimento</h4>
                                <p className="text-xs text-foreground/80 leading-relaxed italic border-l-2 border-primary pl-3 py-1">
                                    "{selectedConvenio?.objeto}"
                                </p>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20">{selectedConvenio?.funcao}</span>
                                    <span className="text-[9px] font-bold bg-muted text-muted-foreground px-2 py-1 rounded border border-border">{selectedConvenio?.subfuncao}</span>
                                </div>
                            </div>

                            <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2">
                                <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Governança Federal</h4>
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-bold leading-tight">{selectedConvenio?.concedente}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Vínculo: {selectedConvenio?.orgaoVinculado}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-6 mt-2 border-t border-border">
                        <button 
                            className="flex-1 h-11 bg-primary text-primary-foreground rounded-lg font-bold uppercase text-[10px] tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            onClick={() => {
                                toast.success("Lead Técnico gerado com sucesso!")
                                setSelectedConvenio(null);
                            }}
                        >
                            <KanbanSquare className="w-4 h-4" /> Transformar em Oportunidade
                        </button>
                        <button 
                            className="w-11 h-11 border border-border rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
                            onClick={() => setSelectedConvenio(null)}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Bottom Insight */}
            <div className="flex items-center gap-4 p-5 bg-primary/5 border border-primary/10 rounded-2xl">
                <div className="p-2 bg-primary/10 rounded-full animate-bounce">
                    <ArrowUpRight className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-0.5">
                    <p className="text-xs font-black text-primary uppercase tracking-widest">Insight de Mercado Polaryon</p>
                    <p className="text-[11px] text-muted-foreground">
                        Utilize os filtros de valor para focar em **Grandes Obras e Aquisições Estruturantes**. 
                        Repasses com valores global alto (&gt; R$ 500k) indicam licitações complexas que exigem planejamento de estoque antecipado.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default InteligenciaPreditiva;
