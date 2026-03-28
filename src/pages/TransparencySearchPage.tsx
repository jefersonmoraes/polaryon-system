import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, 
    Calendar, 
    Building2, 
    FileText, 
    Package, 
    BarChart3, 
    TrendingUp, 
    Info, 
    ChevronRight, 
    Zap,
    Loader2, 
    AlertCircle,
    Download,
    ExternalLink,
    Award,
    Tags,
    DollarSign,
    UserCheck,
    ShieldCheck,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import { toast } from 'sonner';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle 
} from '../components/ui/dialog';
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from '../components/ui/tabs';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Cell
} from 'recharts';

interface Licitacao {
    id: string;
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
    marca?: string;
    modelo?: string;
    vencedor?: {
        nome: string;
        cnpj: string;
        valor: number;
        marcaFornecedor?: string;
        empenhoUrl?: string;
        empenhoDados?: {
            numero?: string;
            data?: string;
            valor?: number;
            orgaoUnidade?: string;
        }
    }
}

interface BiddingFile {
    id: string;
    nome: string;
    url: string;
    originalUrl?: string; // Link direto do PNCP
    dataPublicacao: string;
    documentoVencedor: boolean;
}

interface BrandAnalytics {
    name: string;
    value: number;
    totalGasto: number;
}

export default function TransparencySearchPage() {
    const [keyword, setKeyword] = useState('');
    const [dataInicial, setDataInicial] = useState('');
    const [dataFinal, setDataFinal] = useState('');
    const [situacao, setSituacao] = useState('concluido');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<Licitacao[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState('');
    const [selectedLicitacao, setSelectedLicitacao] = useState<Licitacao | null>(null);
    const [items, setItems] = useState<ItemLicitacao[]>([]);
    const [files, setFiles] = useState<BiddingFile[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [loadingGlobalBrands, setLoadingGlobalBrands] = useState(false);
    const [globalBrands, setGlobalBrands] = useState<BrandAnalytics[]>([]);
    const [winnerFiles, setWinnerFiles] = useState<any[]>([]);
    
    // Estados para o Preview de Empenho (Dentro do Sistema)
    const [previewEmpenhoUrl, setPreviewEmpenhoUrl] = useState<string | null>(null);
    const [previewEmpenhoData, setPreviewEmpenhoData] = useState<any>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Set default dates to last 2 years on mount
    useEffect(() => {
        const end = new Date();
        const start = new Date();
        start.setFullYear(end.getFullYear() - 1);
        
        setDataFinal(end.toISOString().split('T')[0]);
        setDataInicial(start.toISOString().split('T')[0]);
    }, []);

    // Analytics Cache
    const brandRanking = useMemo(() => {
        if (items.length === 0) return [];
        const counts: Record<string, { name: string; value: number; totalGasto: number }> = {};
        
        items.forEach(item => {
            if (item.marca && item.marca !== 'N/A' && item.marca !== 'NÃO INFORMADA') {
                if (!counts[item.marca]) {
                    counts[item.marca] = { name: item.marca, value: 0, totalGasto: 0 };
                }
                counts[item.marca].value++;
                counts[item.marca].totalGasto += (item.valorUnitario || 0) * (item.quantidade || 0);
            }
        });

        return Object.values(counts)
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [items]);

    const fetchGlobalBrands = async (term: string) => {
        setLoadingGlobalBrands(true);
        try {
            const response = await api.get('/transparency/analytics/global-brands', { 
                params: { termo: term },
                timeout: 15000 
            });
            // O backend agora retorna { results, version }
            const brands = response.data?.results || response.data || [];
            setGlobalBrands(Array.isArray(brands) ? brands : []);
        } catch (err) {
            console.error("Erro marcas globais", err);
            setGlobalBrands([]); 
        } finally {
            setLoadingGlobalBrands(false);
        }
    };

    const handlePageChange = (p: number) => {
        handleSearch(undefined, false, p);
    };

    const handleSearch = async (e?: React.FormEvent, isLoadMore = false, forcedPage?: number) => {
        if (e) e.preventDefault();
        
        const currentPage = forcedPage || (isLoadMore ? page + 1 : 1);
        setLoading(true);
        if (!isLoadMore) {
            setResults([]);
            setPage(1);
        } else {
            setPage(currentPage);
        }
        const termToSearch = isLoadMore ? keyword : keyword; // A variável keyword já é o que o usuário quer buscar no momento do submit
        setKeyword(keyword); 
        
        setError('');
        try {
            const response = await api.get('/transparency/licitacoes', {
                params: {
                    termo: keyword,
                    pagina: currentPage,
                    dataInicial: dataInicial || undefined,
                    dataFinal: dataFinal || undefined,
                    status: situacao === 'todas' ? '' : situacao,
                    tam_pagina: 12
                }
            });
            
            const resultsData = response.data.items || [];
            if (isLoadMore) {
                setResults(prev => [...prev, ...resultsData]);
            } else {
                setResults(resultsData);
                // Trigger global analytics IMMEDIATELY on new search
                if (keyword) {
                    fetchGlobalBrands(keyword);
                }
            }
            
            setTotalResults(response.data.totalItems || 0);
            setPage(currentPage);
            setHasMore(currentPage < (response.data.totalPages || 0));
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erro ao conectar com o backend.');
            toast.error("Falha na busca do Portal da Transparência");
        } finally {
            setLoading(false);
        }
    };

    const fetchItems = async (lic: Licitacao) => {
        setLoadingItems(true);
        try {
            const response = await api.get(`/transparency/licitacoes/${lic.cnpjOrgao}/${lic.ano}/${lic.sequencial}/itens-completos`, {
                params: { termo: keyword }
            });
            setItems(Array.isArray(response.data) ? response.data : []);
        } catch (err: any) {
            toast.error("Erro ao carregar itens da licitação");
        } finally {
            setLoadingItems(false);
        }
    };

    const fetchFiles = async (lic: Licitacao) => {
        setLoadingFiles(true);
        try {
            const response = await api.get(`/transparency/licitacoes/${lic.cnpjOrgao}/${lic.ano}/${lic.sequencial}/arquivos`);
            const allFiles = response.data || [];
            setFiles(allFiles);
            setWinnerFiles(allFiles.filter((f: any) => f.isWinnerDoc));
        } catch (err: any) {
            console.error("Erro ao carregar arquivos", err);
        } finally {
            setLoadingFiles(false);
        }
    };

    const handleSelectLicitacao = (lic: Licitacao) => {
        setSelectedLicitacao(lic);
        fetchItems(lic);
        fetchFiles(lic);
    };

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

                    <form onSubmit={handleSearch} className="flex flex-col xl:flex-row gap-3">
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
                        
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 p-1 bg-muted/50 rounded-lg border border-border">
                            <div className="relative flex-1">
                                <span className="absolute -top-2.5 left-2 bg-background px-1 text-[8px] font-bold text-muted-foreground uppercase">De</span>
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input 
                                    type="date" 
                                    value={dataInicial}
                                    onChange={(e) => setDataInicial(e.target.value)}
                                    className="h-8 pl-8 pr-1 bg-background border-none rounded text-[10px] focus:ring-0 outline-none w-full sm:w-32"
                                />
                            </div>
                            <div className="relative flex-1">
                                <span className="absolute -top-2.5 left-2 bg-background px-1 text-[8px] font-bold text-muted-foreground uppercase">Até</span>
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input 
                                    type="date" 
                                    value={dataFinal}
                                    onChange={(e) => setDataFinal(e.target.value)}
                                    className="h-8 pl-8 pr-1 bg-background border-none rounded text-[10px] focus:ring-0 outline-none w-full sm:w-32"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row border border-border rounded-lg overflow-hidden sm:h-10 bg-background">
                            <select 
                                value={situacao}
                                onChange={(e) => setSituacao(e.target.value)}
                                className="h-10 sm:h-full px-3 text-xs bg-transparent outline-none border-b sm:border-b-0 sm:border-r border-border font-medium cursor-pointer"
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
                                className="h-10 sm:h-full px-6 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

                    {!loading && results.length === 0 && !error && (
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
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

                                {results.length > 0 && (
                                    <div className="flex flex-col items-center gap-4 pb-12 mt-8 border-t border-border/50 pt-8">
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            <button 
                                                onClick={() => {
                                                    const prev = Math.max(1, page - 1);
                                                    handlePageChange(prev);
                                                }}
                                                disabled={page === 1 || loading}
                                                className="h-10 px-3 sm:px-4 bg-card border border-border rounded-xl text-xs font-bold hover:border-primary/50 disabled:opacity-30 transition-all flex items-center gap-1 sm:gap-2"
                                            >
                                                <ChevronRight className="h-4 w-4 rotate-180" />
                                                <span className="hidden sm:inline">Anterior</span>
                                            </button>
                                            
                                            <div className="flex items-center gap-1 sm:gap-1.5 px-1 sm:px-2">
                                                {/* Mostrar páginas vizinhas */}
                                                {Array.from({ length: Math.min(Math.ceil(totalResults / 10), 5) }, (_, i) => {
                                                    const p = i + 1;
                                                    const isMobileHide = p > 3 && p !== page;
                                                    return (
                                                        <button
                                                            key={p}
                                                            onClick={() => handlePageChange(p)}
                                                            disabled={loading}
                                                            className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl text-xs font-bold transition-all ${isMobileHide ? 'hidden sm:flex' : 'flex'} items-center justify-center ${page === p ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-card border border-border hover:border-primary/50'}`}
                                                        >
                                                            {p}
                                                        </button>
                                                    );
                                                })}
                                                {Math.ceil(totalResults / 10) > 5 && <span className="text-muted-foreground px-1 hidden sm:inline">...</span>}
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    const next = page + 1;
                                                    handlePageChange(next);
                                                }}
                                                disabled={!hasMore || loading}
                                                className="h-10 px-3 sm:px-4 bg-card border border-border rounded-xl text-xs font-bold hover:border-primary/50 disabled:opacity-30 transition-all flex items-center gap-1 sm:gap-2"
                                            >
                                                <span className="hidden sm:inline">Próxima</span>
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                                            Página {page} de {Math.ceil(totalResults / 10)} • {totalResults} Processos encontrados
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Global Stats */}
                            <div className="lg:w-80 shrink-0 space-y-6">
                                {loadingGlobalBrands ? (
                                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 animate-pulse">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            <h3 className="text-sm font-bold uppercase">Analisando Mercado...</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {[1,2,3,4,5].map(i => <div key={i} className="h-6 bg-muted rounded animate-pulse" />)}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground italic">Consultando os 20 processos mais recentes para extrair marcas...</p>
                                    </div>
                                ) : (globalBrands.length > 0) ? (
                                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm animate-in fade-in slide-in-from-right-4">
                                        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                                                <h3 className="font-black text-[10px] uppercase tracking-wider text-muted-foreground">Ranking de Mercado (Amostra)</h3>
                                            </div>
                                            <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                                        </div>
                                        <div className="space-y-4">
                                            {globalBrands.slice(0, 10).map((b, i) => (
                                                <div key={i} className="flex flex-col gap-1.5 group cursor-default">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-[10px] font-black truncate pr-2 uppercase group-hover:text-primary transition-colors">{b.name}</span>
                                                        <span className="text-[10px] font-black text-primary">{b.value}</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden border border-border/20">
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${(b.value / globalBrands[0].value) * 100}%` }}
                                                            className="h-full bg-gradient-to-r from-primary/80 to-primary"
                                                        />
                                                    </div>
                                                    <div className="flex justify-between items-center opacity-70">
                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(b.totalGasto)}</span>
                                                        <span className="text-[8px] text-muted-foreground">{Math.round((b.value / globalBrands.reduce((acc, x) => acc + x.value, 0)) * 100)}% do volume</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-3 border-t border-border mt-4">
                                            <div className="flex items-center gap-2 text-primary/80 mb-1">
                                                <ShieldCheck className="h-3 w-3" />
                                                <span className="text-[10px] font-black uppercase tracking-tighter">Deep Intelligence</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                                Análise em tempo real dos <strong>20 processos mais recentes</strong> concluídos para este item (Todos os Âmbitos).
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-card/50 border border-border/50 border-dashed rounded-2xl p-8 text-center space-y-3">
                                        <Info className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                                        <p className="text-xs text-muted-foreground font-medium italic">Nenhuma marca consolidada nos 20 processos recentes.</p>
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
                                    <div className="px-4 md:px-6 border-b border-border bg-card">
                                        <TabsList className="bg-transparent h-12 gap-3 md:gap-6 p-0 flex-nowrap overflow-x-auto scrollbar-hide">
                                            <TabsTrigger 
                                                value="itens" 
                                                className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-[10px] md:text-sm font-bold whitespace-nowrap"
                                            >
                                                <Package className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                                                Itens e Vencedores
                                            </TabsTrigger>
                                            <TabsTrigger 
                                                value="winner-docs" 
                                                className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-[10px] md:text-sm font-bold whitespace-nowrap"
                                            >
                                                <Award className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                                                Docs do Vencedor
                                            </TabsTrigger>
                                            <TabsTrigger 
                                                value="analytics" 
                                                className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-[10px] md:text-sm font-bold whitespace-nowrap"
                                            >
                                                <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                                                Análise de Mercado
                                            </TabsTrigger>
                                            <TabsTrigger 
                                                value="files" 
                                                className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-[10px] md:text-sm font-bold whitespace-nowrap"
                                            >
                                                <FileText className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                                                Arquivos PNCP
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
                                                            <div className="md:w-72 shrink-0 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between relative shadow-sm">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="bg-emerald-500 text-white p-1 rounded-md">
                                                                            <Award className="h-3.5 w-3.5" />
                                                                        </div>
                                                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
                                                                            Ganhador & Marca
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2 border border-emerald-500/10">
                                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">Marca Ofertada:</p>
                                                                        <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 break-words line-clamp-2 leading-tight">
                                                                            {(item.vencedor as any).marcaFornecedor || (item.vencedor as any).marca || item.marca || 'N/A'}
                                                                        </p>
                                                                    </div>

                                                                    <div className="pt-1">
                                                                        <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">Empresa Vencedora:</p>
                                                                        <p className="text-[11px] font-extrabold line-clamp-2 leading-snug">{item.vencedor.nome}</p>
                                                                        <div className="flex items-center gap-1.5 mt-1">
                                                                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                                                                CNPJ: {item.vencedor.cnpj}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {(item.vencedor as any).empenhoUrl && (
                                                                        <button 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setPreviewEmpenhoUrl((item.vencedor as any).empenhoUrl);
                                                                                setPreviewEmpenhoData((item.vencedor as any).empenhoDados);
                                                                                setIsPreviewOpen(true);
                                                                            }}
                                                                            className="mt-2 flex items-center justify-center gap-2 w-full py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                                                        >
                                                                            <FileText className="h-3 w-3" />
                                                                            VER DETALHES DO EMPENHO
                                                                            <ExternalLink className="h-2.5 w-2.5" />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                <div className="mt-3 pt-2 border-t border-emerald-500/10 flex items-center justify-between">
                                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Valor Ganho</span>
                                                                    <p className="text-sm text-emerald-600 font-extrabold italic">
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

                                    <TabsContent value="winner-docs" className="flex-1 overflow-auto p-6 focus-visible:outline-none">
                                        <div className="space-y-6">
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-4">
                                                <div className="bg-emerald-500 text-white p-2 rounded-lg shadow-sm">
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-emerald-800">Documentação do Vencedor</h4>
                                                    <p className="text-xs text-emerald-600 font-medium">Arquivos identificados como propostas, habilitação e homologação final.</p>
                                                </div>
                                            </div>

                                            {winnerFiles.length === 0 ? (
                                                <div className="text-center py-12 opacity-50 space-y-2 border-2 border-dashed border-border rounded-2xl">
                                                    <Info className="h-10 w-10 mx-auto" />
                                                    <p className="text-sm">Não encontramos documentos marcados como "Vencedor" nesta amostra.</p>
                                                    <p className="text-xs">Tente a aba "Arquivos PNCP" para ver todos os documentos disponíveis.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {winnerFiles.map((file, idx) => (
                                                        <a 
                                                            key={idx}
                                                            href={file.url_bucket || file.url_origem}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-4 p-4 bg-white dark:bg-card border border-border rounded-xl hover:border-emerald-500 hover:shadow-md transition-all group"
                                                        >
                                                            <div className="p-3 bg-muted group-hover:bg-emerald-50 rounded-lg group-hover:text-emerald-600 transition-colors">
                                                                <Download className="h-5 w-5" />
                                                            </div>
                                                            <div className="flex-1 overflow-hidden">
                                                                <p className="text-sm font-bold truncate uppercase">{file.titulo || file.nome_arquivo}</p>
                                                                <p className="text-[10px] text-muted-foreground font-medium uppercase">Tipo: Documento do Ganhador</p>
                                                            </div>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
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
                                                                <div 
                                                                    key={file.id}
                                                                    className="flex flex-col gap-2 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl hover:border-emerald-500/50 hover:shadow-md transition-all group"
                                                                >
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg">
                                                                            <FileText className="h-5 w-5" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <h4 className="text-sm font-bold truncate leading-tight">{file.nome}</h4>
                                                                            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">Proposta / Vencedor</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-2 mt-2">
                                                                        <a 
                                                                            href={file.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex-1 h-8 bg-emerald-600 text-white text-[10px] font-bold rounded flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
                                                                        >
                                                                            <Download className="h-3 w-3" /> DOWNLOAD OFICIAL
                                                                        </a>
                                                                        <a 
                                                                            href={file.originalUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="px-3 h-8 border border-emerald-600/30 text-emerald-600 text-[10px] font-bold rounded flex items-center justify-center hover:bg-emerald-500/10 transition-colors"
                                                                        >
                                                                            LINK DIRETO (PNCP)
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Outros Documentos */}
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-bold uppercase text-muted-foreground">Outros Editais e Anexos</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {files.filter(f => !f.documentoVencedor).map((file) => (
                                                            <div 
                                                                key={file.id}
                                                                className="flex flex-col gap-2 p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all group"
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className="p-3 bg-primary/10 text-primary rounded-lg">
                                                                        <FileText className="h-5 w-5" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="text-sm font-bold truncate leading-tight">{file.nome}</h4>
                                                                        <p className="text-[10px] text-muted-foreground mt-1">
                                                                            Publicado em {new Date(file.dataPublicacao).toLocaleDateString('pt-BR')}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-2 mt-2">
                                                                    <a 
                                                                        href={file.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex-1 h-8 bg-primary text-primary-foreground text-[10px] font-bold rounded flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                                                                    >
                                                                        <Download className="h-3 w-3" /> DOWNLOAD
                                                                    </a>
                                                                    <a 
                                                                        href={file.originalUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="px-3 h-8 border border-border text-muted-foreground text-[10px] font-bold rounded flex items-center justify-center hover:bg-muted transition-colors"
                                                                    >
                                                                        ABRIR NO PNCP
                                                                    </a>
                                                                </div>
                                                            </div>
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

            {/* Modal de Detalhes do Empenho (Visualização Digital) */}
            <AnimatePresence>
                {isPreviewOpen && (
                    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                        <DialogContent className="max-w-2xl w-[95vw] p-0 border-border bg-background shadow-2xl z-[150] flex flex-col sm:rounded-xl overflow-hidden">
                            <DialogHeader className="p-4 border-b border-border bg-emerald-600 text-white flex-row items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-md font-bold text-white uppercase tracking-tight">
                                            Dados do Empenho
                                        </DialogTitle>
                                        <p className="text-[10px] opacity-80 font-medium tracking-wide">Extraído do Portal da Transparência (CGU)</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsPreviewOpen(false)}
                                    className="h-8 w-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </DialogHeader>
                            
                            <div className="p-6 space-y-6 bg-card/30">
                                {/* Alerta sobre o Bloqueio de Iframe */}
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-4">
                                    <div className="p-2 bg-emerald-500/20 text-emerald-600 rounded-lg shrink-0">
                                        <Info className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-emerald-700">Acesso Restrito do Governo</h4>
                                        <p className="text-xs text-emerald-600 leading-relaxed">
                                            O Portal da Transparência não permite a visualização direta do documento original dentro deste sistema por questões de segurança.
                                        </p>
                                    </div>
                                </div>

                                {/* Dados Consolidados */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 bg-background border border-border rounded-xl shadow-sm space-y-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Identificação</label>
                                        <p className="text-sm font-bold text-primary">{previewEmpenhoData?.numero || 'Não informado'}</p>
                                    </div>
                                    <div className="p-4 bg-background border border-border rounded-xl shadow-sm space-y-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data de Emissão</label>
                                        <p className="text-sm font-bold text-primary">{previewEmpenhoData?.data || '--/--/----'}</p>
                                    </div>
                                    <div className="p-4 bg-background border border-border rounded-xl shadow-sm space-y-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Valor Empenhado</label>
                                        <p className="text-xl font-black text-emerald-600">
                                            {previewEmpenhoData?.valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(previewEmpenhoData.valor) : 'R$ 0,00'}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border flex flex-col gap-3">
                                    <a 
                                        href={previewEmpenhoUrl || '#'} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-600/20 group"
                                    >
                                        <ExternalLink className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                        {previewEmpenhoData ? 'ABRIR DOCUMENTO COMPLETO NO PORTAL' : 'LOCALIZAR DOCUMENTOS NO PORTAL'}
                                    </a>
                                    <p className="text-[10px] text-center text-muted-foreground font-medium">
                                        {previewEmpenhoData 
                                            ? 'Clique acima para visualizar a nota fiscal e histórico de pagamentos.' 
                                            : 'Não encontramos o empenho exato desta amostra. Clique acima para pesquisar manualmente no portal.'}
                                    </p>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>
        </div>
    );
}
