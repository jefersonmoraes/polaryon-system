import { useState, useMemo, useEffect } from 'react';
import { Search, Building2, Truck, Briefcase, MapPin, Phone, Mail, Loader2, Check, ExternalLink, Star, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { useKanbanStore } from '@/store/kanban-store';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { getFaviconUrl } from '@/lib/utils';

interface CnpjResult {
    cnpj: string;
    razao_social: string;
    nome_fantasia: string;
    descricao_situacao_cadastral: string;
    data_inicio_atividade: string;
    cnae_fiscal_descricao: string;
    cep: string;
    uf: string;
    municipio: string;
    bairro: string;
    logradouro: string;
    numero: string;
    complemento: string;
    ddd_telefone_1: string;
    ddd_telefone_2: string;
    email?: string;
    correio_eletronico?: string;
    correioEletronico?: string;
}

const SuppliersPage = () => {
    const [cnpj, setCnpj] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<CnpjResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const [filterRegiao, setFilterRegiao] = useState('');
    const [filterArea, setFilterArea] = useState('');
    const [expandedSuppliers, setExpandedSuppliers] = useState(false);
    const [expandedTransporters, setExpandedTransporters] = useState(false);

    const { addCompany, companies, budgets = [], fetchCompanies, fetchBudgets } = useKanbanStore();
    const { currentUser } = useAuthStore();

    useEffect(() => {
        fetchCompanies();
        fetchBudgets();
    }, [fetchCompanies, fetchBudgets]);

    // Calculate dynamic ratings from budgets
    const companyRatings = useMemo(() => {
        const ratingsMap: Record<string, { total: number; count: number }> = {};

        budgets.forEach(b => {
            b.items?.forEach(item => {
                if (item.companyId && item.supplierRating) {
                    if (!ratingsMap[item.companyId]) ratingsMap[item.companyId] = { total: 0, count: 0 };
                    ratingsMap[item.companyId].total += item.supplierRating;
                    ratingsMap[item.companyId].count++;
                }
                if (item.transporterId && item.transporterRating) {
                    if (!ratingsMap[item.transporterId]) ratingsMap[item.transporterId] = { total: 0, count: 0 };
                    ratingsMap[item.transporterId].total += item.transporterRating;
                    ratingsMap[item.transporterId].count++;
                }
            });
        });

        const finalRatings: Record<string, number> = {};
        Object.keys(ratingsMap).forEach(key => {
            finalRatings[key] = Math.round(ratingsMap[key].total / ratingsMap[key].count);
        });

        return finalRatings;
    }, [budgets]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCnpj = cnpj.replace(/\D/g, '');

        if (cleanCnpj.length !== 14) {
            setError('CNPJ deve conter 14 dígitos');
            toast.error('CNPJ inválido');
            return;
        }

        setError(null);

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
            if (!response.ok) throw new Error('Falha ao buscar CNPJ');
            const data = await response.json();
            
            // Normalize data - ensure email is captured from different possible fields
            const normalizedData = {
                ...data,
                email: data.email || data.correio_eletronico || data.correioEletronico || ''
            };
            
            setResult(normalizedData);
            toast.success('Empresa encontrada!');
        } catch {
            toast.error('Erro ao consultar CNPJ. Verifique se o número está correto.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = (type: 'Fornecedor' | 'Transportadora') => {
        if (!result) return;

        // Check Permissions
        const { currentUser } = useAuthStore.getState();
        if (currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit) {
            toast.error('Você não tem permissão para cadastrar novas empresas.');
            return;
        }

        // Check for Duplicates
        const isDuplicate = companies.some(c => c.cnpj === result.cnpj);
        if (isDuplicate) {
            toast.error('Empresa já está cadastrada no sistema!');
            return;
        }

        // Check for Invalid Status
        const invalidStatuses = ['BAIXADA', 'INAPTA', 'SUSPENSA', 'NULA'];
        if (invalidStatuses.includes(result.descricao_situacao_cadastral.toUpperCase())) {
            toast.error(`Não é possível salvar. CNPJ consta como: ${result.descricao_situacao_cadastral}`);
            return;
        }

        const newId = addCompany({
            type,
            cnpj: result.cnpj,
            razao_social: result.razao_social,
            nome_fantasia: result.nome_fantasia,
            descricao_situacao_cadastral: result.descricao_situacao_cadastral,
            cnae_fiscal_descricao: result.cnae_fiscal_descricao,
            cep: result.cep,
            uf: result.uf,
            municipio: result.municipio,
            bairro: result.bairro,
            logradouro: result.logradouro,
            numero: result.numero,
            complemento: result.complemento,
            ddd_telefone_1: result.ddd_telefone_1?.replace(/\D/g, '') || '',
            ddd_telefone_2: result.ddd_telefone_2?.replace(/\D/g, '') || '',
            email: result.email || result.correio_eletronico || result.correioEletronico || '',

            // Initialize new fields
            contacts: [],
            comments: '',
            amostra: false,
            frete: '',
            mantemOferta: '',
            areasAtuacao: [],
            lastCnpjCheck: new Date().toISOString()
        });

        toast.success(`Salvo como ${type} com sucesso!`);
        setCnpj('');
        setResult(null);

        // Auto-open the profile
        const targetPath = type === 'Fornecedor' ? '/suppliers-list' : '/transporters-list';
        navigate(`${targetPath}?id=${newId}`);
    };

    // Format CNPJ as user types
    const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 14) value = value.slice(0, 14);

        // Apply mask 00.000.000/0000-00
        if (value.length > 12) {
            value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
        } else if (value.length > 8) {
            value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4}).*/, '$1.$2.$3/$4');
        } else if (value.length > 5) {
            value = value.replace(/^(\d{2})(\d{3})(\d{0,3}).*/, '$1.$2.$3');
        } else if (value.length > 2) {
            value = value.replace(/^(\d{2})(\d{0,3}).*/, '$1.$2');
        }

        setCnpj(value);
        if (error) setError(null);
    };

    return (
        <div className="flex-1 bg-background relative">
            <div className="h-full overflow-auto p-6 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">

                    {/* Header section */}
                    <div className="flex items-center gap-3 pb-4 border-b border-border">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary">
                            <Building2 className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Fornecedores e Transportadoras</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Consulte e adicione novas empresas ao diretório automaticamente a partir do CNPJ.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Search Column */}
                        <div className="md:col-span-1 space-y-6">
                            <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 relative overflow-hidden">
                                {currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit && (
                                    <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-4 text-center">
                                        <div className="p-3 bg-destructive/10 text-destructive rounded-full mb-2">
                                            <Search className="h-6 w-6" />
                                        </div>
                                        <p className="font-bold text-sm text-foreground">Acesso Restrito</p>
                                        <p className="text-xs text-muted-foreground mt-1">Sua conta tem permissão apenas para leitura.</p>
                                    </div>
                                )}
                                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-foreground/80">
                                    <Search className="h-5 w-5" />
                                    Consultar CNPJ
                                </h2>
                                <form onSubmit={handleSearch} className="space-y-4">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Digite o CNPJ (apenas números)"
                                            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent transition-all ${error ? 'border-destructive focus:ring-destructive animate-shake shadow-[0_0_0_1px_rgba(239,68,68,0.5)]' : 'border-border focus:ring-primary'}`}
                                            value={cnpj}
                                            onChange={handleCnpjChange}
                                            maxLength={18} // Max length for formatted CNPJ
                                            disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                        />
                                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${error ? 'text-destructive' : 'text-muted-foreground'}`} />
                                    </div>
                                    {error && <p className="text-[10px] text-destructive font-bold uppercase mt-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
                                    <button
                                        type="submit"
                                        disabled={loading || cnpj.replace(/\D/g, '').length !== 14 || (currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit)}
                                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-primary/50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        Consultar CNPJ
                                    </button>
                                </form>
                            </div>

                            {/* Quick tips */}
                            <div className="bg-accent/10 border border-border rounded-xl p-4 text-sm text-foreground text-center">
                                <p className="font-semibold mb-1 text-primary">Dica de uso</p>
                                <p className="text-xs text-muted-foreground">
                                    Os dados serão importados da Receita Federal. Após consultar, escolha se a empresa atuará como fornecedor ou transportadora no seu fluxo.
                                </p>
                            </div>
                        </div>

                        {/* Result or Dashboard Column */}
                        <div className="md:col-span-2">
                            {!result ? (
                                <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 overflow-hidden flex flex-col h-full overflow-y-auto custom-scrollbar">

                                    {(() => {
                                        const favoriteSuppliers = companies.filter(c => !c.trashed && c.isFavorite && c.type === 'Fornecedor' && (filterArea ? c.areasAtuacao?.includes(filterArea) : true));
                                        const favoriteTransporters = companies.filter(c => !c.trashed && c.isFavorite && c.type === 'Transportadora' && (filterRegiao ? c.uf === filterRegiao : true));

                                        const INITIAL_COUNT = 4;
                                        const visibleSuppliers = expandedSuppliers ? favoriteSuppliers : favoriteSuppliers.slice(0, INITIAL_COUNT);
                                        const visibleTransporters = expandedTransporters ? favoriteTransporters : favoriteTransporters.slice(0, INITIAL_COUNT);

                                        const availableStates = Array.from(new Set(companies.map(c => c.uf).filter(Boolean))).sort();
                                        const availableAreas = Array.from(new Set(companies.filter(c => c.type === 'Fornecedor').flatMap(c => c.areasAtuacao || []))).sort();

                                        return (
                                            <div className="space-y-8">
                                                {/* Fornecedores em Destaque */}
                                                <div>
                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                                        <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground/80">
                                                            <Briefcase className="h-5 w-5 text-blue-500" />
                                                            Fornecedores em Destaque
                                                        </h2>
                                                        <select
                                                            value={filterArea}
                                                            onChange={(e) => setFilterArea(e.target.value)}
                                                            className="text-xs bg-muted border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
                                                        >
                                                            <option value="">Todas as Áreas</option>
                                                            {availableAreas.map(area => (
                                                                <option key={area} value={area}>{area}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {favoriteSuppliers.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground italic bg-muted/20 p-4 border border-dashed rounded-xl text-center">Nenhum fornecedor favoritado ou encontrado neste filtro.</p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            {visibleSuppliers.map(company => (
                                                                <Link to={`/suppliers-list?id=${company.id}`} key={company.id} className="group p-4 bg-muted/30 border border-border/50 rounded-xl hover:bg-accent/50 hover:border-border transition-all flex flex-col relative overflow-hidden">
                                                                    <div className="flex items-start justify-between mb-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="relative shrink-0">
                                                                                <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-md">
                                                                                    <Building2 className="h-4 w-4" />
                                                                                </div>
                                                                                {company.customLink && (
                                                                                    <img 
                                                                                        src={getFaviconUrl(company.customLink)} 
                                                                                        alt=""
                                                                                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-sm shrink-0"
                                                                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-foreground truncate max-w-[140px]">{company.nickname || company.nome_fantasia || company.razao_social}</p>
                                                                                <p className="text-[10px] text-muted-foreground">{company.cnpj}</p>
                                                                            </div>
                                                                        </div>
                                                                        <Heart className="h-4 w-4 fill-red-500 text-red-500 shrink-0" />
                                                                    </div>

                                                                    <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between">
                                                                        <div className="flex text-yellow-500" title={`Média das cotações (${companyRatings[company.id] || 0} estrelas)`}>
                                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                                <Star key={star} className={`h-3 w-3 ${star <= (companyRatings[company.id] || 0) ? 'fill-current' : 'text-muted-foreground/20'}`} />
                                                                            ))}
                                                                        </div>
                                                                        <span className="text-[10px] bg-background px-2 py-0.5 rounded text-muted-foreground font-medium border border-border/50 truncate max-w-[100px]" title={company.areasAtuacao?.join(', ') || 'Geral'}>
                                                                            {company.areasAtuacao?.[0] || 'Geral'}
                                                                        </span>
                                                                    </div>
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {favoriteSuppliers.length > INITIAL_COUNT && (
                                                        <button
                                                            onClick={() => setExpandedSuppliers(!expandedSuppliers)}
                                                            className="w-full mt-4 py-2 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg transition-colors border border-dashed border-border/50"
                                                        >
                                                            {expandedSuppliers ? (
                                                                <><ChevronUp className="h-4 w-4" /> Mostrar menos</>
                                                            ) : (
                                                                <><ChevronDown className="h-4 w-4" /> Mostrar todos ({favoriteSuppliers.length})</>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Transportadoras em Destaque */}
                                                <div>
                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                                        <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground/80">
                                                            <Truck className="h-5 w-5 text-emerald-500" />
                                                            Transportadoras em Destaque
                                                        </h2>
                                                        <select
                                                            value={filterRegiao}
                                                            onChange={(e) => setFilterRegiao(e.target.value)}
                                                            className="text-xs bg-muted border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
                                                        >
                                                            <option value="">Todas as Regiões (UF)</option>
                                                            {availableStates.map(uf => (
                                                                <option key={uf} value={uf}>{uf === '?' ? 'N/A' : uf}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {favoriteTransporters.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground italic bg-muted/20 p-4 border border-dashed rounded-xl text-center">Nenhuma transportadora favoritada ou encontrada neste filtro.</p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            {visibleTransporters.map(company => (
                                                                <Link to={`/transporters-list?id=${company.id}`} key={company.id} className="group p-4 bg-muted/30 border border-border/50 rounded-xl hover:bg-accent/50 hover:border-border transition-all flex flex-col relative overflow-hidden">
                                                                    <div className="flex items-start justify-between mb-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="relative shrink-0">
                                                                                <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-md">
                                                                                    <Truck className="h-4 w-4" />
                                                                                </div>
                                                                                {company.customLink && (
                                                                                    <img 
                                                                                        src={getFaviconUrl(company.customLink)} 
                                                                                        alt=""
                                                                                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-sm shrink-0"
                                                                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-foreground truncate max-w-[140px]">{company.nome_fantasia || company.razao_social}</p>
                                                                                <p className="text-[10px] text-muted-foreground">{company.cnpj}</p>
                                                                            </div>
                                                                        </div>
                                                                        <Heart className="h-4 w-4 fill-red-500 text-red-500 shrink-0" />
                                                                    </div>

                                                                    <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between">
                                                                        <div className="flex text-yellow-500" title={`Média das cotações (${companyRatings[company.id] || 0} estrelas)`}>
                                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                                <Star key={star} className={`h-3 w-3 ${star <= (companyRatings[company.id] || 0) ? 'fill-current' : 'text-muted-foreground/20'}`} />
                                                                            ))}
                                                                        </div>
                                                                        <span className="text-[10px] bg-background px-2 py-0.5 rounded text-muted-foreground font-medium border border-border/50">
                                                                            {company.logradouro ? `${company.municipio}/${company.uf}` : 'Sem Endereço'}
                                                                        </span>
                                                                    </div>
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {favoriteTransporters.length > INITIAL_COUNT && (
                                                        <button
                                                            onClick={() => setExpandedTransporters(!expandedTransporters)}
                                                            className="w-full mt-4 py-2 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg transition-colors border border-dashed border-border/50"
                                                        >
                                                            {expandedTransporters ? (
                                                                <><ChevronUp className="h-4 w-4" /> Mostrar menos</>
                                                            ) : (
                                                                <><ChevronDown className="h-4 w-4" /> Mostrar todas ({favoriteTransporters.length})</>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden h-full flex flex-col">
                                    <div className="p-6 border-b border-border bg-muted/10 flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-primary/10 rounded-xl text-primary mt-1">
                                                <Building2 className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-foreground">{result.razao_social}</h2>
                                                {result.nome_fantasia && (
                                                    <p className="text-sm font-medium text-muted-foreground mt-0.5">{result.nome_fantasia}</p>
                                                )}
                                                <div className="flex items-center gap-3 mt-3">
                                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${result.descricao_situacao_cadastral === 'ATIVA' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                                                        {result.descricao_situacao_cadastral}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md">
                                                        <Briefcase className="h-3 w-3" />
                                                        CNPJ: {result.cnpj}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setResult(null)} className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                                            <ExternalLink className="h-4 w-4 rotate-180" />
                                        </button>
                                    </div>

                                    <div className="p-6 flex-1 overflow-auto custom-scrollbar">
                                        <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Detalhes da Empresa</h3>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Atividade Principal</p>
                                                <p className="text-sm font-medium text-foreground">{result.cnae_fiscal_descricao}</p>
                                            </div>

                                            <div className="space-y-2 sm:col-span-2 bg-muted/30 p-4 rounded-xl border border-border/50 text-sm">
                                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Endereço Completo</p>
                                                <p className="text-foreground">{result.logradouro}, {result.numero} {result.complemento ? `- ${result.complemento}` : ''}</p>
                                                <p className="text-muted-foreground">{result.bairro} - {result.municipio} / {result.uf}</p>
                                                <p className="text-muted-foreground mt-1 font-medium">CEP: {result.cep}</p>
                                            </div>

                                            <div className="space-y-1 mt-2">
                                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Telefones de Contato</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-foreground">{result.ddd_telefone_1}</p>
                                                    {result.ddd_telefone_1 && (
                                                        <a href={`https://wa.me/55${result.ddd_telefone_1.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1 bg-green-500/10 text-green-600 rounded hover:bg-green-500/20 transition-colors" title="WhatsApp">
                                                            <Phone className="h-3 w-3" />
                                                        </a>
                                                    )}
                                                </div>
                                                {result.ddd_telefone_2 && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-sm font-medium text-foreground">{result.ddd_telefone_2}</p>
                                                        <a href={`https://wa.me/55${result.ddd_telefone_2.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1 bg-green-500/10 text-green-600 rounded hover:bg-green-500/20 transition-colors" title="WhatsApp">
                                                            <Phone className="h-3 w-3" />
                                                        </a>
                                                    </div>
                                                )}
                                                {!result.ddd_telefone_1 && !result.ddd_telefone_2 && <span className="text-xs text-muted-foreground italic">Não informado</span>}
                                            </div>

                                            <div className="space-y-1 mt-2">
                                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Endereço de E-mail</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-foreground break-all">{result.email || <span className="text-xs text-muted-foreground italic">Não informado</span>}</p>
                                                    {result.email && (
                                                        <a href={`mailto:${result.email}`} className="p-1 bg-blue-500/10 text-blue-600 rounded hover:bg-blue-500/20 transition-colors shrink-0" title="Enviar E-mail">
                                                            <Mail className="h-3 w-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Save Button / Action */}
                                    <div className="mt-8 pt-6 border-t border-border flex flex-col lg:flex-row gap-4 items-center justify-between">
                                        <p className="text-sm text-muted-foreground flex items-center gap-2 text-center lg:text-left">
                                            <Briefcase className="h-4 w-4 shrink-0" />
                                            Salve este contato para acesso rápido nas suas tarefas e boards.
                                        </p>
                                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                                            <button
                                                onClick={() => setResult(null)}
                                                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                            >
                                                Limpar Busca
                                            </button>
                                            <button
                                                onClick={() => handleSave('Fornecedor')}
                                                className="w-full sm:w-auto px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg shadow-md hover:bg-primary/90 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                            >
                                                <Building2 className="h-4 w-4" />
                                                Salvar Fornecedor
                                            </button>
                                            <button
                                                onClick={() => handleSave('Transportadora')}
                                                className="w-full sm:w-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                            >
                                                <Truck className="h-4 w-4" />
                                                Salvar Transportadora
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuppliersPage;
