import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, Filter, Loader2, AlertCircle, ChevronRight, 
    Building2, MapPin, Calendar, DollarSign, BarChart3, 
    Zap, ShieldCheck, Save, ExternalLink, Info, Award,
    Tags, Package, TrendingUp, UserCheck
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
}

export default function TransparencySearchPage() {
    // Search States
    const [keyword, setKeyword] = useState('');
    const [dataInicial, setDataInicial] = useState('');
    const [dataFinal, setDataFinal] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<Licitacao[]>([]);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);

    // Detail States
    const [selectedLicitacao, setSelectedLicitacao] = useState<Licitacao | null>(null);
    const [items, setItems] = useState<ItemLicitacao[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Filtered Results based on Keyword (if API doesn't support it)
    const filteredResults = useMemo(() => {
        if (!keyword) return results;
        return results.filter(lic => 
            lic.objeto?.toLowerCase().includes(keyword.toLowerCase()) || 
            lic.orgaoLicitante?.nome?.toLowerCase().includes(keyword.toLowerCase())
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

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setLoading(true);
        setError('');
        try {
            // Use Backend Proxy
            const response = await api.get('/transparency/licitacoes', {
                params: {
                    termo: keyword,
                    pagina: page,
                    dataInicial: dataInicial ? dataInicial.replace(/-/g, '') : undefined,
                    dataFinal: dataFinal ? dataFinal.replace(/-/g, '') : undefined,
                }
            });
            
            // Note: API Portal Transparência usually returns an array directly
            setResults(Array.isArray(response.data) ? response.data : []);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erro ao conectar com o backend. Verifique o Token da API no .env');
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

    const handleSelectLicitacao = (lic: Licitacao) => {
        setSelectedLicitacao(lic);
        fetchItems(lic.id);
    };

    const handleSaveSupplier = (item: ItemLicitacao) => {
        if (!item.vencedor?.cnpj || !item.vencedor?.nome) {
            toast.error("Dados do vencedor incompletos para salvar.");
            return;
        }

        const { addCompany, companies } = useKanbanStore.getState();
        
        const exists = companies.some(c => c.cnpj === item.vencedor?.cnpj);
        if (exists) {
            toast.warning("Este fornecedor já está cadastrado.");
            return;
        }

        addCompany({
            type: 'Fornecedor',
            cnpj: item.vencedor.cnpj,
            razao_social: item.vencedor.nome,
            nome_fantasia: item.marca || item.vencedor.nome,
            descricao_situacao_cadastral: 'ATIVA',
            lastCnpjCheck: new Date().toISOString()
        });

        toast.success(`Fornecedor ${item.vencedor.nome} salvo com sucesso!`);
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

                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input 
                                type="text"
                                placeholder="Refinar por objeto (ex: Notebook, Arroz, Consultoria)..."
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="w-full h-10 bg-background border border-border rounded-lg pl-9 pr-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input 
                                    type="date" 
                                    value={dataInicial}
                                    onChange={(e) => setDataInicial(e.target.value)}
                                    className="h-10 pl-9 pr-2 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <span className="text-muted-foreground">até</span>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input 
                                    type="date" 
                                    value={dataFinal}
                                    onChange={(e) => setDataFinal(e.target.value)}
                                    className="h-10 pl-9 pr-2 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="h-10 px-6 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2 shadow-md shadow-primary/20 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            Buscar Agora
                        </button>
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
                                                Estatísticas de Marcas
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
                                                            <div className="md:w-64 shrink-0 bg-background/60 border border-border/40 rounded-lg p-3 flex flex-col justify-between relative">
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                                                        <Award className="h-3 w-3" /> VENCEDOR
                                                                    </span>
                                                                    <p className="text-xs font-bold leading-tight line-clamp-2 uppercase">
                                                                        {item.vencedor.nome}
                                                                    </p>
                                                                    <p className="text-[10px] text-muted-foreground">CNPJ: {item.vencedor.cnpj}</p>
                                                                    <p className="text-[10px] text-emerald-600 font-bold">
                                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.vencedor.valor)}
                                                                    </p>
                                                                </div>
                                                                
                                                                <button 
                                                                    onClick={() => handleSaveSupplier(item)}
                                                                    className="mt-3 w-full py-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
                                                                >
                                                                    <Save className="h-3 w-3" />
                                                                    SALVAR FORNECEDOR
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="analytics" className="flex-1 overflow-auto p-6 focus-visible:outline-none bg-muted/5">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Brand Ranking Chart */}
                                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                                        <TrendingUp className="h-4 w-4 text-primary" />
                                                        Ranking de Marcas (Volume de Itens)
                                                    </h3>
                                                </div>
                                                <div className="h-[300px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={brandRanking} layout="vertical" margin={{ left: -20, right: 20 }}>
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
                                                                {brandRanking.map((entry, index) => (
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
                                                        <p className="text-xs font-bold text-muted-foreground uppercase">Marca Líder</p>
                                                        <p className="text-xl font-black text-foreground">{brandRanking[0]?.name || 'N/A'}</p>
                                                        <p className="text-[10px] text-muted-foreground">Dominância de {brandRanking[0] ? Math.round((brandRanking[0].value / items.length) * 100) : 0}% dos itens</p>
                                                    </div>
                                                </div>

                                                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center items-center text-center space-y-2">
                                                    <div className="p-3 bg-blue-500/10 text-blue-500 rounded-full">
                                                        <DollarSign className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-muted-foreground uppercase">Impacto Financeiro</p>
                                                        <p className="text-xl font-black text-foreground">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(items.reduce((acc, i) => acc + (i.valorTotal || 0), 0))}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground">Volume Total Analisado</p>
                                                    </div>
                                                </div>

                                                <div className="sm:col-span-2 bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 rounded-2xl p-6">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                                                        <UserCheck className="h-4 w-4" /> Principais Fornecedores
                                                    </h4>
                                                    <div className="space-y-3">
                                                        {Array.from(new Set(items.map(i => i.vencedor?.nome))).slice(0, 3).map((v, i) => v && (
                                                            <div key={i} className="flex justify-between items-center p-2 bg-background/40 rounded-lg border border-border/40">
                                                                <span className="text-xs font-bold truncate max-w-[200px]">{v}</span>
                                                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-black">{items.filter(it => it.vencedor?.nome === v).length} vitórias</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
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
