import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, Filter, Loader2, AlertCircle, ChevronRight, 
    Building2, MapPin, Calendar, DollarSign, BarChart3, 
    Zap, ShieldCheck, Save, ExternalLink, Info, Award,
    Tags, Package, TrendingUp, UserCheck, FileText, Download
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import api from '@/lib/api';
import { useKanbanStore } from '@/store/kanban-store';
import { toast } from 'sonner';

interface Licitacao {
    id: string; // "cnpj/ano/sequencial"
    numeroLicitacao: string;
    objeto: string;
    orgao: string;
    dataAbertura: string;
    valorLicitacao: number;
    situacao: string;
    cnpjOrgao: string;
    ano: number;
    sequencial: string;
}

interface ItemLicitacao {
    numero: number;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    vencedor?: {
        nome: string;
        cnpj: string;
        valor: number;
    };
    marca: string;
    modelo?: string;
}

interface BiddingFile {
    id: string;
    nome: string;
    url: string;
    dataPublicacao: string;
    documentoVencedor?: boolean;
}

interface BrandAnalytics {
    name: string;
    value: number;
    totalGasto: number;
}

export default function TransparencySearchPage() {
    // Search States
    const [keyword, setKeyword] = useState('');
    const [dataInicial, setDataInicial] = useState('');
    const [dataFinal, setDataFinal] = useState('');
    const [situacao, setSituacao] = useState('todas');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<Licitacao[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    // Detail States
    const [selectedLicitacao, setSelectedLicitacao] = useState<Licitacao | null>(null);
    const [items, setItems] = useState<ItemLicitacao[]>([]);
    const [files, setFiles] = useState<BiddingFile[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [loadingGlobalBrands, setLoadingGlobalBrands] = useState(false);
    const [globalBrands, setGlobalBrands] = useState<BrandAnalytics[]>([]);

    // Filtered Results based on Keyword (if API doesn't support it)
    const filteredResults = useMemo(() => {
        if (!keyword) return results;
        return results.filter(lic => 
            lic.objeto?.toLowerCase().includes(keyword.toLowerCase()) || 
            lic.orgao?.toLowerCase().includes(keyword.toLowerCase())
        );
    }, [results, keyword]);

    // Analytics Cache
    const brandRanking = useMemo(() => {
        if (items.length === 0) return [];
        const counts: Record<string, { name: string; value: number; totalGasto: number }> = {};
        
        items.forEach(item => {
            if (item.marca && item.marca !== 'Não informada' && item.marca !== 'Ver detalhes no edital') {
                const brand = item.marca.toUpperCase().trim();
                if (!counts[brand]) counts[brand] = { name: brand, value: 0, totalGasto: 0 };
                counts[brand].value++;
                counts[brand].totalGasto += (item.quantidade * item.valorUnitario) || 0;
            }
        });

        return Object.values(counts)
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [items]);

    const fetchGlobalBrands = async (term: string) => {
        setLoadingGlobalBrands(true);
        try {
            const response = await api.get('/transparency/analytics/global-brands', { params: { termo: term } });
            setGlobalBrands(response.data);
        } catch (err) {
            console.error("Erro marcas globais", err);
        } finally {
            setLoadingGlobalBrands(false);
        }
    };

    const handleSearch = async (e?: React.FormEvent, isLoadMore = false) => {
        e?.preventDefault();
        const currentPage = isLoadMore ? page + 1 : 1;
        if (!isLoadMore) {
            setLoading(true);
            setResults([]);
            setPage(1);
        } else {
            setPage(currentPage);
        }
        
        setError('');
        try {
            const response = await api.get('/transparency/licitacoes', {
                params: {
                    termo: keyword,
                    pagina: currentPage,
                    dataInicial: dataInicial || undefined,
                    dataFinal: dataFinal || undefined,
                    situacao: situacao !== 'todas' ? situacao : undefined,
                    tam_pagina: 20
                }
            });
            
            const newItems = response.data.items || [];
            setResults(prev => isLoadMore ? [...prev, ...newItems] : newItems);
            setTotalResults(response.data.totalItems || 0);
            setHasMore(currentPage < (response.data.totalPages || 0));

            if (!isLoadMore && keyword) {
                fetchGlobalBrands(keyword);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erro ao conectar com o backend.');
            toast.error("Falha na busca do Portal da Transparência");
        } finally {
            setLoading(false);
        }
    };

    const fetchItems = async (licId: string) => {
        setLoadingItems(true);
        try {
            const response = await api.get(`/transparency/licitacoes/${licId}/itens`);
            setItems(Array.isArray(response.data) ? response.data : []);
        } catch (err: any) {
            toast.error("Erro ao carregar itens da licitação");
        } finally {
            setLoadingItems(false);
        }
    };

    const fetchFiles = async (licId: string) => {
        setLoadingFiles(true);
        try {
            const response = await api.get(`/transparency/licitacoes/${licId}/arquivos`);
            setFiles(Array.isArray(response.data) ? response.data : []);
        } catch (err: any) {
            console.error("Erro ao carregar arquivos", err);
        } finally {
            setLoadingFiles(false);
        }
    };

    const handleSelectLicitacao = (lic: Licitacao) => {
        setSelectedLicitacao(lic);
        fetchItems(lic.id);
        fetchFiles(lic.id);
    };

    // Removed handleSaveSupplier as per user request

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-background text-foreground">
            {/* Header */}
            <div className="bg-card border-b border-border p-4 shadow-sm z-10">
                <div className="max-w-7xl mx-auto space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Busca Portal da Transparência</h1>
                            <p className="text-xs text-muted-foreground">Consulta aprofundada de licitações, marcas e volume por objeto.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input 
                                type="text"
                                placeholder="O que você procura? (ex: Notebook, Arroz, Consultoria)..."
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="w-full h-10 bg-background border border-border rounded-lg pl-9 pr-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            />
                        </div>
                        
                        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg border border-border">
                            <div className="relative">
                                <span className="absolute -top-2.5 left-2 bg-background px-1 text-[8px] font-bold text-muted-foreground uppercase">De</span>
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input 
                                    type="date" 
                                    value={dataInicial}
                                    onChange={(e) => setDataInicial(e.target.value)}
                                    className="h-8 pl-8 pr-1 bg-background border-none rounded text-[10px] focus:ring-0 outline-none w-32"
                                />
                            </div>
                            <div className="relative">
                                <span className="absolute -top-2.5 left-2 bg-background px-1 text-[8px] font-bold text-muted-foreground uppercase">Até</span>
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input 
                                    type="date" 
                                    value={dataFinal}
                                    onChange={(e) => setDataFinal(e.target.value)}
                                    className="h-8 pl-8 pr-1 bg-background border-none rounded text-[10px] focus:ring-0 outline-none w-32"
                                />
                            </div>
                        </div>

                        <div className="flex border border-border rounded-lg overflow-hidden h-10 bg-background">
                            <select 
                                value={situacao}
                                onChange={(e) => setSituacao(e.target.value)}
                                className="h-full px-3 text-xs bg-transparent outline-none border-r border-border font-medium cursor-pointer"
                            >
                                <option value="todas">Todas as Situações</option>
                                <option value="em-andamento">Em Andamento</option>
                                <option value="concluido">Concluído</option>
                                <option value="suspenso">Suspenso</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                            <button 
                                type="submit"
                                disabled={loading}
                                className="h-full px-6 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                Buscar
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto bg-muted/20">
                <div className="max-w-7xl mx-auto p-4 lg:p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {!loading && filteredResults.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50">
                            <Search className="h-12 w-12 text-muted-foreground" />
                            <div>
                                <h3 className="text-lg font-bold">Nenhum resultado para exibir</h3>
                                <p className="text-sm">Preencha o período e clique em buscar para consultar o Portal da Transparência.</p>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                            <p className="text-sm font-medium text-muted-foreground">Interrogando base do PNCP...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {/* Global Analytics Top Row */}
                            {globalBrands.length > 0 && results.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    {globalBrands.slice(0, 3).map((brand, i) => (
                                        <div key={i} className="bg-gradient-to-br from-card to-muted/30 border border-border/60 p-4 rounded-2xl shadow-sm flex items-center gap-4 group hover:border-primary/40 transition-all">
                                            <div className="p-3 bg-primary/10 text-primary rounded-xl font-black text-xl">
                                                {i + 1}º
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Top Recorrência</p>
                                                <h4 className="font-black text-sm truncate uppercase">{brand.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded font-bold">{brand.value} Vitórias</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(brand.totalGasto)}</span>
                                                </div>
                                            </div>
                                            <TrendingUp className="h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col lg:flex-row gap-6">
                            {/* Left Column: Search Results */}
                            <div className="flex-1 flex flex-col gap-6">
                                <div className="grid grid-cols-1 gap-4">
                                    {results.map((lic) => (
                                        <motion.div 
                                            key={lic.id}
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            onClick={() => handleSelectLicitacao(lic)}
                                            className="bg-card border border-border/60 p-5 rounded-2xl hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 cursor-pointer transition-all group relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="p-2 bg-primary/10 text-primary rounded-full">
                                                    <ChevronRight className="h-5 w-5" />
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-4">
                                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary/80">
                                                    <Building2 className="h-3 w-3" />
                                                    {lic.orgao}
                                                </div>
                                                
                                                <div>
                                                    <h3 className="text-base font-bold leading-tight line-clamp-2">
                                                        {lic.objeto}
                                                    </h3>
                                                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground italic">
                                                        <span>Licitação Nº {lic.numeroLicitacao}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Publicado em {new Date(lic.dataAbertura).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    <span className="bg-emerald-500/10 px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
                                                        {lic.situacao}
                                                    </span>
                                                    <span className="bg-blue-500/10 px-2 py-0.5 rounded-md text-[10px] font-bold text-blue-600 border border-blue-500/20">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lic.valorLicitacao)}
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                {hasMore && results.length > 0 && (
                                    <div className="flex justify-center pb-10">
                                        <button 
                                            onClick={() => handleSearch(undefined, true)}
                                            className="h-10 px-6 bg-card border border-border rounded-lg text-sm font-bold hover:border-primary/50 transition-all flex items-center gap-2"
                                        >
                                            Carregar Mais Processos
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Global Stats */}
                            <div className="lg:w-80 shrink-0 space-y-6">
                                {(globalBrands.length > 0) && (
                                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-right-4">
                                        <h3 className="text-sm font-bold flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-primary" />
                                            Ranking Global de Marcas
                                        </h3>
                                        <div className="space-y-3">
                                            {globalBrands.slice(0, 8).map((b, i) => (
                                                <div key={i} className="flex flex-col gap-1">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-[10px] font-bold truncate pr-2 uppercase">{b.name}</span>
                                                        <span className="text-[10px] font-black text-primary">{b.value}</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${(b.value / globalBrands[0].value) * 100}%` }}
                                                            className="h-full bg-primary"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-2 border-t border-border mt-4">
                                            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                                Este ranking é gerado dinamicamente com base nos últimos processos homologados para "{keyword}".
                                            </p>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 space-y-3">
                                    <div className="flex items-center gap-2 text-primary">
                                        <Info className="h-4 w-4" />
                                        <h4 className="text-xs font-bold uppercase">Sobre a Busca</h4>
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                                        Total de <strong>{totalResults}</strong> processos encontrados. Os dados de marcas são extraídos via processamento de linguagem natural (PLN) sobre os itens homologados.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                </div>
            </div>

            {/* Detail Dialog */}
            <Dialog open={!!selectedLicitacao} onOpenChange={(o) => !o && setSelectedLicitacao(null)}>
                <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col border-border bg-background overflow-hidden shadow-2xl">
                    {selectedLicitacao && (
                        <>
                            <DialogHeader className="p-6 border-b border-border shrink-0 bg-muted/20">
                                <div className="flex items-start justify-between gap-6 mr-8">
                                    <div className="space-y-1">
                                        <DialogTitle className="text-xl font-bold leading-tight">
                                            {selectedLicitacao.objeto}
                                        </DialogTitle>
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <span className="font-semibold text-primary">Nº {selectedLicitacao.numeroLicitacao}</span>
                                            <span>•</span>
                                            <span>{selectedLicitacao.orgao}</span>
                                        </div>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="flex-1 overflow-hidden">
                                <Tabs defaultValue="itens" className="h-full flex flex-col">
                                    <div className="px-6 border-b border-border bg-card">
                                        <TabsList className="bg-transparent h-12 gap-6 p-0">
                                            <TabsTrigger 
                                                value="itens" 
                                                className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-sm font-bold"
                                            >
                                                <Package className="h-4 w-4 mr-2" />
                                                Itens e Vencedores
                                            </TabsTrigger>
                                            <TabsTrigger 
                                                value="analytics" 
                                                className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-sm font-bold"
                                            >
                                                <BarChart3 className="h-4 w-4 mr-2" />
                                                Estatísticas de Marcas {keyword ? `para "${keyword}"` : ''}
                                            </TabsTrigger>
                                            <TabsTrigger 
                                                value="files" 
                                                className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-sm font-bold"
                                            >
                                                <FileText className="h-4 w-4 mr-2" />
                                                Arquivos e Editais
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <TabsContent value="itens" className="flex-1 overflow-auto p-6 focus-visible:outline-none">
                                        {loadingItems ? (
                                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                                <p className="text-sm font-medium text-muted-foreground">Buscando itens e detalhes dos produtos...</p>
                                            </div>
                                        ) : items.length === 0 ? (
                                            <div className="text-center py-12 opacity-50 space-y-2">
                                                <Info className="h-10 w-10 mx-auto" />
                                                <p className="text-sm">Nenhum item detalhado encontrado nesta licitação.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {items.map((item, idx) => (
                                                    <div key={idx} className="bg-muted/30 border border-border/50 rounded-xl p-4 flex flex-col md:flex-row gap-6 relative overflow-hidden group">
                                                        <div className="flex-1 space-y-3">
                                                            <h4 className="font-bold text-sm leading-snug">
                                                                {item.descricao}
                                                            </h4>
                                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                                <div>
                                                                    <span className="block text-[10px] font-bold text-muted-foreground uppercase">Qtd</span>
                                                                    <span className="text-sm font-medium">{item.quantidade} units</span>
                                                                </div>
                                                                <div>
                                                                    <span className="block text-[10px] font-bold text-muted-foreground uppercase">Valor Unit.</span>
                                                                    <span className="text-sm font-bold text-primary">
                                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorUnitario)}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="block text-[10px] font-bold text-muted-foreground uppercase">Marca</span>
                                                                    <span className="text-sm font-bold flex items-center gap-1.5">
                                                                        <Tags className="h-3 w-3 text-amber-500" />
                                                                        {item.marca || 'NÃO INFORMADA'}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="block text-[10px] font-bold text-muted-foreground uppercase">Modelo</span>
                                                                    <span className="text-sm font-medium text-muted-foreground">{item.modelo || '-'}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {item.vencedor && (
                                                            <div className="md:w-64 shrink-0 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 flex flex-col justify-between relative">
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                                                        <Award className="h-3 w-3" /> MARCA VENCEDORA
                                                                    </span>
                                                                    <p className="text-sm font-black leading-tight line-clamp-2 uppercase text-emerald-700">
                                                                        {item.marca || 'NÃO INFORMADA'}
                                                                    </p>
                                                                    <div className="mt-2 pt-2 border-t border-emerald-500/10">
                                                                        <p className="text-[10px] text-muted-foreground font-medium uppercase">Empresa Detentora:</p>
                                                                        <p className="text-[10px] font-bold truncate">{item.vencedor.nome}</p>
                                                                        <p className="text-[10px] text-muted-foreground">CNPJ: {item.vencedor.cnpj}</p>
                                                                    </div>
                                                                    <p className="text-xs text-emerald-600 font-bold mt-1">
                                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.vencedor.valor)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="analytics" className="flex-1 overflow-auto p-6 focus-visible:outline-none bg-muted/5">
                                        {loadingGlobalBrands ? (
                                            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                                <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                                                <p className="text-sm font-medium text-muted-foreground">Compilando ranking global de fornecedores e marcas...</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {/* Brand Ranking Chart */}
                                                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <h3 className="text-sm font-bold flex items-center gap-2">
                                                            <TrendingUp className="h-4 w-4 text-primary" />
                                                            Ranking Consolidado (Top 10 Marcas)
                                                        </h3>
                                                    </div>
                                                    <div className="h-[300px] w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={globalBrands.length > 0 ? globalBrands : brandRanking} layout="vertical" margin={{ left: -20, right: 20 }}>
                                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                                                <XAxis type="number" hide />
                                                                <YAxis 
                                                                    dataKey="name" 
                                                                    type="category" 
                                                                    width={120} 
                                                                    tick={{ fontSize: 10, fontWeight: 600 }}
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                />
                                                                <Tooltip 
                                                                    contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                                                    itemStyle={{ color: '#fff' }}
                                                                />
                                                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                                                    {(globalBrands.length > 0 ? globalBrands : brandRanking).map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                    ))}
                                                                </Bar>
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>

                                                {/* Summary Cards */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center items-center text-center space-y-2">
                                                        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full">
                                                            <Award className="h-6 w-6" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-muted-foreground uppercase">Marca Líder Global</p>
                                                            <p className="text-xl font-black text-foreground">{(globalBrands.length > 0 ? globalBrands : brandRanking)[0]?.name || 'N/A'}</p>
                                                            <p className="text-[10px] text-muted-foreground">Baseado em {(globalBrands.length > 0 ? globalBrands : brandRanking).reduce((acc, b) => acc + b.value, 0)} ocorrências detectadas</p>
                                                        </div>
                                                    </div>

                                                    <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center items-center text-center space-y-2">
                                                        <div className="p-3 bg-blue-500/10 text-blue-500 rounded-full">
                                                            <DollarSign className="h-6 w-6" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-muted-foreground uppercase">Impacto Financeiro</p>
                                                            <p className="text-xl font-black text-foreground">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format((globalBrands.length > 0 ? globalBrands : brandRanking).reduce((acc, b) => acc + b.totalGasto, 0))}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground">Somatório de itens com esta marca</p>
                                                        </div>
                                                    </div>

                                                    <div className="sm:col-span-2 bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 rounded-2xl p-6">
                                                        <h4 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                                                            <UserCheck className="h-4 w-4" /> Players em Destaque
                                                        </h4>
                                                        <div className="space-y-4">
                                                            {(globalBrands.length > 0 ? globalBrands : brandRanking).slice(0, 5).map((b, i) => (
                                                                <div key={i} className="flex justify-between items-center p-2 bg-background/40 rounded-lg border border-border/40">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold">{b.name}</span>
                                                                        <span className="text-[10px] text-muted-foreground italic">Total Gasto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b.totalGasto)}</span>
                                                                    </div>
                                                                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-black">{b.value} registros</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="files" className="flex-1 overflow-auto p-6 focus-visible:outline-none">
                                        {loadingFiles ? (
                                            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                                <p className="text-sm font-medium text-muted-foreground">Localizando repositório de arquivos no PNCP...</p>
                                            </div>
                                        ) : files.length === 0 ? (
                                            <div className="text-center py-20 opacity-50 space-y-4">
                                                <FileText className="h-12 w-12 mx-auto" />
                                                <div>
                                                    <h4 className="font-bold">Nenhum documento disponível</h4>
                                                    <p className="text-xs max-w-[300px] mx-auto">Muitos órgãos utilizam portais externos ou não publicam os arquivos diretamente no barramento do PNCP.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {/* Documentos do Vencedor */}
                                                {files.filter(f => f.documentoVencedor).length > 0 && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-bold uppercase text-emerald-600 flex items-center gap-2">
                                                            <ShieldCheck className="h-4 w-4" /> Documentos do Vencedor
                                                        </h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {files.filter(f => f.documentoVencedor).map((file) => (
                                                                <a 
                                                                    key={file.id}
                                                                    href={file.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl hover:border-emerald-500/50 hover:shadow-md transition-all group"
                                                                >
                                                                    <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                                                        <Download className="h-5 w-5" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="text-sm font-bold truncate leading-tight">{file.nome}</h4>
                                                                        <p className="text-[10px] text-muted-foreground mt-1 uppercase">Proposta/Habilitação</p>
                                                                    </div>
                                                                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Outros Documentos */}
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-bold uppercase text-muted-foreground">Outros Editais e Anexos</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {files.filter(f => !f.documentoVencedor).map((file) => (
                                                            <a 
                                                                key={file.id}
                                                                href={file.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all group"
                                                            >
                                                                <div className="p-3 bg-red-500/10 text-red-500 rounded-lg group-hover:bg-red-500 group-hover:text-white transition-colors">
                                                                    <Download className="h-5 w-5" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="text-sm font-bold truncate leading-tight">{file.nome}</h4>
                                                                    <p className="text-[10px] text-muted-foreground mt-1">
                                                                        Publicado em {new Date(file.dataPublicacao).toLocaleDateString('pt-BR')}
                                                                    </p>
                                                                </div>
                                                                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100" />
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
