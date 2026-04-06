import { useState, useMemo, useEffect } from 'react';
import { cn, fixDateToBRT, getFaviconUrl } from '@/lib/utils';
import { useKanbanStore } from '@/store/kanban-store';
import { Budget, BudgetStatus, BudgetType } from '@/types/kanban';
import {
    Calculator, Plus, Search, Filter, MoreVertical,
    Trash2, Edit, Building2, Calendar, FileText, FolderOpen,
    Clock, FileSearch, CheckCircle2, XCircle, ArrowUpDown, Link as LinkIcon, Archive, Truck, DollarSign
} from 'lucide-react';
import BudgetModal from '@/components/budgets/BudgetModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuthStore } from '@/store/auth-store';

const statusStyles: Record<BudgetStatus, string> = {
    Aguardando: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    Cotado: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    Aprovado: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    Recusado: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

const statusIcons: Record<BudgetStatus, React.ReactNode> = {
    Aguardando: <Clock className="h-3.5 w-3.5" />,
    Cotado: <FileSearch className="h-3.5 w-3.5" />,
    Aprovado: <CheckCircle2 className="h-3.5 w-3.5" />,
    Recusado: <XCircle className="h-3.5 w-3.5" />,
};

const typeStyles: Record<BudgetType, string> = {
    Produto: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    Serviço: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
};

const BudgetsPage = () => {
    const { budgets, companies, cards, lists, boards, folders, deleteBudget, updateBudget, fetchBudgets, fetchCompanies } = useKanbanStore();

    // Auto-fetch data on mount
    useEffect(() => {
        fetchBudgets();
        fetchCompanies();
    }, [fetchBudgets, fetchCompanies]);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<BudgetType | 'Todos'>('Todos');
    const [statusFilter, setStatusFilter] = useState<BudgetStatus | 'Todos'>('Todos');
    const [selectedBudget, setSelectedBudget] = useState<Budget | undefined>();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const { currentUser } = useAuthStore();
    const canEdit = currentUser?.role === 'ADMIN' || currentUser?.permissions?.canEdit;

    const filteredBudgets = useMemo(() => {
        return budgets
            .filter(b => !b.trashed && !b.archived)
            .filter(b => typeFilter === 'Todos' || b.type === typeFilter)
            .filter(b => statusFilter === 'Todos' || b.status === statusFilter)
            .filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.items?.some(i => {
                    const comp = companies.find(c => c.id === i.companyId);
                    const trans = companies.find(c => c.id === i.transporterId);
                    
                    const term = searchQuery.toLowerCase();
                    
                    const matchComp = comp && (
                        comp.razao_social.toLowerCase().includes(term) ||
                        (comp.nome_fantasia && comp.nome_fantasia.toLowerCase().includes(term)) ||
                        (comp.nickname && comp.nickname.toLowerCase().includes(term))
                    );

                    const matchTrans = trans && (
                        trans.razao_social.toLowerCase().includes(term) ||
                        (trans.nome_fantasia && trans.nome_fantasia.toLowerCase().includes(term)) ||
                        (trans.nickname && trans.nickname.toLowerCase().includes(term))
                    );

                    return matchComp || matchTrans;
                }))
            .sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            });
    }, [budgets, typeFilter, statusFilter, searchQuery, companies, sortOrder]);

    const getCompanyFavicon = (id?: string) => {
        if (!id) return undefined;
        const c = companies.find(c => c.id === id);
        return c?.customLink ? getFaviconUrl(c.customLink) : undefined;
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const handleEdit = (budget: Budget) => {
        setSelectedBudget(budget);
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setSelectedBudget(undefined);
        setIsModalOpen(true);
    };

    const getCompanyName = (id?: string) => {
        if (!id) return 'Não informada';
        const c = companies.find(c => c.id === id);
        return c ? (c.nickname || c.nome_fantasia || c.razao_social) : 'Empresa não encontrada';
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            {/* Header Area */}
            <div className="flex-none p-6 border-b border-border bg-card/50">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                            <Calculator className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Orçamentos</h1>
                            <p className="text-sm text-muted-foreground">Gerencie cotações de produtos, serviços e fretes</p>
                        </div>
                    </div>

                    <button
                        onClick={handleNew}
                        disabled={!canEdit}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="h-4 w-4" />
                        Novo Orçamento
                    </button>
                </div>

                {/* Filters Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar por título ou empresa..."
                            className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar shrink-0">
                        <div className="flex bg-background border border-border rounded-lg p-1">
                            {(['Todos', 'Produto', 'Serviço'] as const).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setTypeFilter(type)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${typeFilter === type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <div className="flex bg-background border border-border rounded-lg p-1">
                            {(['Todos', 'Aguardando', 'Cotado', 'Aprovado', 'Recusado'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${statusFilter === status ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                            className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
                            title={sortOrder === 'desc' ? 'Mais recentes primeiro' : 'Mais antigos primeiro'}
                        >
                            <ArrowUpDown className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content (Grid) */}
            <div className="flex-1 overflow-y-auto p-6 bg-secondary/20 custom-scrollbar">
                {filteredBudgets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                        <div className="p-4 bg-primary/5 rounded-full mb-4">
                            <Calculator className="h-10 w-10 text-primary opacity-50" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Nenhum orçamento encontrado</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            {budgets.length === 0 ? 'Você ainda não criou nenhum orçamento. Comece adicionando o primeiro!' : 'Nenhum orçamento corresponde aos filtros atuais. Tente limpar a busca.'}
                        </p>
                        {budgets.length > 0 && (
                            <button
                                onClick={() => { setSearchQuery(''); setTypeFilter('Todos'); setStatusFilter('Todos'); }}
                                className="text-sm font-semibold text-primary hover:underline"
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredBudgets.map(budget => (
                            <div
                                key={budget.id}
                                onClick={() => handleEdit(budget)}
                                className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group flex flex-col relative overflow-hidden cursor-pointer"
                            >
                                {/* Status Indicator Bar */}
                                <div className={`absolute top-0 left-0 w-full h-1 ${statusStyles[budget.status].split(' ')[0]} border-none opacity-50`} />

                                <div className="flex justify-between items-start mb-3 gap-2">
                                    <div className="flex flex-wrap gap-1.5">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${statusStyles[budget.status]}`}>
                                            {statusIcons[budget.status]}
                                            {budget.status}
                                        </span>
                                        {(() => {
                                            const favorites = (budget.items || []).filter(i => i.isFavorite);
                                            if (favorites.length === 0) {
                                                return (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${typeStyles[budget.type || 'Produto']}`}>
                                                        {budget.type || 'Produto'}
                                                    </span>
                                                );
                                            }
                                            const typesSet = new Set(favorites.map(i => i.type || budget.type || 'Produto'));
                                            return Array.from(typesSet).map(t => (
                                                <span key={t} className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${typeStyles[t as BudgetType]}`}>
                                                    {t}
                                                </span>
                                            ));
                                        })()}
                                    </div>

                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-1.5 -mr-1 text-muted-foreground hover:bg-secondary rounded transition-colors"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" className="w-40 p-1">
                                            {canEdit ? (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(budget); }} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary transition-colors flex items-center gap-2">
                                                        <Edit className="h-3.5 w-3.5" /> Editar
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); updateBudget(budget.id, { archived: true }); }} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary text-muted-foreground transition-colors flex items-center gap-2">
                                                        <Archive className="h-3.5 w-3.5" /> Arquivar
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); deleteBudget(budget.id); }} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2">
                                                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="px-2 py-1.5 text-[10px] text-muted-foreground text-center">
                                                    Visualização apenas
                                                </div>
                                            )}
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <h3 className="font-bold text-base mb-1 line-clamp-2 leading-tight" title={budget.title}>
                                    {budget.title}
                                </h3>

                                <div className="text-xs text-muted-foreground flex flex-col gap-1 mb-4">
                                    {(() => {
                                        // Pega fornecedores únicos dentre as cotações
                                        const suppliers = Array.from(new Set(budget.items?.filter(i => i.companyId).map(i => i.companyId) || []));
                                        const transporters = Array.from(new Set(budget.items?.filter(i => i.transporterId).map(i => i.transporterId) || []));

                                        return (
                                            <>
                                                <div className="flex items-center gap-1.5 min-w-0" title={suppliers.map(getCompanyName).join(', ')}>
                                                <Building2 className="h-3 w-3 shrink-0" />
                                                <div className="flex -space-x-1 overflow-hidden shrink-0">
                                                    {suppliers.slice(0, 3).map(sid => {
                                                        const fav = getCompanyFavicon(sid);
                                                        if (!fav) return null;
                                                        return (
                                                            <img 
                                                                key={sid}
                                                                src={fav} 
                                                                alt=""
                                                                className="w-6 h-6 rounded-sm shrink-0 ring-1 ring-background"
                                                                onError={(e) => (e.currentTarget.style.display = 'none')}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                                {suppliers.length > 0 ? (
                                                    <span className="truncate">{suppliers.length} Fornecedor{suppliers.length > 1 ? 'es' : ''}</span>
                                                ) : 'Sem Fornecedor'}
                                            </div>
                                                {transporters.length > 0 && (
                                                    <div className="flex items-center gap-1 line-clamp-1 text-primary/80" title={transporters.map(getCompanyName).join(', ')}>
                                                        <Truck className="h-3.5 w-3.5 shrink-0" />
                                                        {transporters.length} Transportadora{transporters.length > 1 ? 's' : ''}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                                {budget.cardId && (() => {
                                    const linkedCard = cards.find(c => c.id === budget.cardId);
                                    const linkedList = linkedCard ? lists.find(l => l.id === linkedCard.listId) : null;
                                    const linkedBoard = linkedList ? boards.find(b => b.id === linkedList.boardId) : null;
                                    const linkedFolder = linkedBoard ? folders.find(f => f.id === linkedBoard.folderId) : null;

                                    return (
                                        <div className="flex flex-wrap items-center gap-1.5 mb-4">
                                            <div className="text-[10px] text-primary/80 bg-primary/10 px-2 py-1 rounded w-fit flex items-center gap-1 line-clamp-1 border border-primary/20" title={`Cartão: ${linkedCard?.title || 'não encontrado'}`}>
                                                <LinkIcon className="h-3 w-3 shrink-0" />
                                                {linkedCard?.title || 'Cartão não encontrado'}
                                            </div>
                                            {linkedList && (
                                                <div
                                                    className="text-[10px] font-bold px-2 py-1 rounded text-white shadow-sm flex items-center gap-1 border border-black/10"
                                                    style={{ background: `linear-gradient(135deg, ${linkedList.color || '#8b5cf6'}cc, ${linkedList.color || '#8b5cf6'})` }}
                                                    title={`Lista: ${linkedList.title}`}
                                                >
                                                    Lista: {linkedList.title}
                                                </div>
                                            )}
                                            {linkedFolder && (
                                                <div className="text-[10px] text-muted-foreground bg-secondary px-2 py-1 rounded flex items-center gap-1 border border-border" title={`Pasta: ${linkedFolder.name}`}>
                                                    <span className="opacity-70">Folder:</span> {linkedFolder.name}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="mt-auto pt-4 border-t border-border flex justify-between items-end">
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <FileText className="h-3.5 w-3.5" /> {budget.items?.length || 0} cotações
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 mt-2">
                                            {(() => {
                                                const favorites = (budget.items || []).filter(i => i.isFavorite);
                                                return favorites.length > 1 ? 'Cotações Favoritas' : 'Melhor Cotação';
                                            })()}
                                        </p>
                                        {(() => {
                                            if (!budget.items || budget.items.length === 0) {
                                                return <p className="font-bold text-muted-foreground text-sm leading-none tracking-tight">R$ 0,00</p>;
                                            }
                                            
                                            const favorites = budget.items.filter(i => i.isFavorite);
                                            
                                            if (favorites.length > 0) {
                                                const totalSum = favorites.reduce((acc, f) => acc + (f.finalSellingPrice || f.totalPrice || 0), 0);
                                                const totalProfit = favorites.reduce((acc, f) => {
                                                    const sell = f.finalSellingPrice || f.totalPrice || 0;
                                                    const cost = f.totalPrice || 0;
                                                    const tax = f.taxValue || 0;
                                                    const difal = f.difalValue || 0;
                                                    return acc + (sell - cost - tax - difal);
                                                }, 0);
                                                
                                                const companiesList = Array.from(new Set(favorites.map(f => getCompanyName(f.companyId)))).join(', ');
                                                
                                                return (
                                                    <div className="flex flex-col items-end">
                                                        {(totalProfit !== 0) && (
                                                            <span className={cn(
                                                                "text-[10px] uppercase font-bold px-2 rounded mb-1 border",
                                                                totalProfit > 0 ? "text-green-600 bg-green-500/10 border-green-500/20" : "text-red-600 bg-red-500/10 border-red-500/20"
                                                            )} title="Lucro Bruto Agregado das Cotações Favoritas">
                                                                LUCRO EMPRESA: {formatCurrency(totalProfit)}
                                                            </span>
                                                        )}
                                                        <p className="font-bold text-primary flex items-center gap-1 text-base leading-none tracking-tight">
                                                            <DollarSign className="h-4 w-4" />
                                                            {formatCurrency(totalSum)}
                                                        </p>
                                                        <span className="text-[10px] text-muted-foreground opacity-70 mt-0.5 truncate max-w-[150px]" title={companiesList}>
                                                            {favorites.length > 1 ? 'Múltiplos Favoritos' : getCompanyName(favorites[0].companyId)}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            // Fallback to lowest overall (when no favorites exist)
                                            const winningQuotation = [...budget.items].sort((a, b) => {
                                                const aPrice = a.finalSellingPrice || a.totalPrice || 0;
                                                const bPrice = b.finalSellingPrice || b.totalPrice || 0;
                                                return aPrice - bPrice;
                                            })[0];

                                            const bestProfit = (winningQuotation.finalSellingPrice || winningQuotation.totalPrice || 0) - (winningQuotation.totalPrice || 0) - (winningQuotation.taxValue || 0) - (winningQuotation.difalValue || 0);

                                            return (
                                                <div className="flex flex-col items-end">
                                                    {(bestProfit !== 0) && (
                                                        <span className={cn(
                                                            "text-[10px] uppercase font-bold px-2 rounded mb-1 border",
                                                            bestProfit > 0 ? "text-green-600 bg-green-500/10 border-green-500/20" : "text-red-600 bg-red-500/10 border-red-500/20"
                                                        )} title="Lucro Bruto da Empresa nesta cotação">
                                                            LUCRO EMPRESA: {formatCurrency(bestProfit)}
                                                        </span>
                                                    )}
                                                    <p className="font-bold text-primary flex items-center gap-1 text-base leading-none tracking-tight">
                                                        <DollarSign className="h-4 w-4" />
                                                        {formatCurrency(winningQuotation.finalSellingPrice || winningQuotation.totalPrice || 0)}
                                                    </p>
                                                    <span className="text-[10px] text-muted-foreground opacity-70 mt-0.5 truncate max-w-[150px]" title={getCompanyName(winningQuotation.companyId)}>
                                                        {getCompanyName(winningQuotation.companyId)}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {
                isModalOpen && (
                    <BudgetModal
                        budget={selectedBudget}
                        onClose={() => setIsModalOpen(false)}
                    />
                )
            }
        </div >
    );
};

export default BudgetsPage;
