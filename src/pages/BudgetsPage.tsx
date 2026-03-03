import { useState, useMemo } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { Budget, BudgetStatus, BudgetType } from '@/types/kanban';
import {
    Calculator, Plus, Search, Filter, MoreVertical,
    Trash2, Edit, Building2, Calendar, FileText,
    Clock, FileSearch, CheckCircle2, XCircle, ArrowUpDown
} from 'lucide-react';
import BudgetModal from '@/components/budgets/BudgetModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
    Frete: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
};

const BudgetsPage = () => {
    const { budgets, companies, deleteBudget } = useKanbanStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<BudgetType | 'Todos'>('Todos');
    const [statusFilter, setStatusFilter] = useState<BudgetStatus | 'Todos'>('Todos');
    const [selectedBudget, setSelectedBudget] = useState<Budget | undefined>();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    const filteredBudgets = useMemo(() => {
        return budgets
            .filter(b => !b.trashed)
            .filter(b => typeFilter === 'Todos' || b.type === typeFilter)
            .filter(b => statusFilter === 'Todos' || b.status === statusFilter)
            .filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                companies.find(c => c.id === b.companyId)?.razao_social.toLowerCase().includes(searchQuery.toLowerCase()) ||
                companies.find(c => c.id === b.companyId)?.nome_fantasia?.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            });
    }, [budgets, typeFilter, statusFilter, searchQuery, companies, sortOrder]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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
        return c ? (c.nome_fantasia || c.razao_social) : 'Empresa não encontrada';
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
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
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
                            {(['Todos', 'Produto', 'Serviço', 'Frete'] as const).map(type => (
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
                            <div key={budget.id} className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group flex flex-col relative overflow-hidden">
                                {/* Status Indicator Bar */}
                                <div className={`absolute top-0 left-0 w-full h-1 ${statusStyles[budget.status].split(' ')[0]} border-none opacity-50`} />

                                <div className="flex justify-between items-start mb-3 gap-2">
                                    <div className="flex flex-wrap gap-1.5">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${statusStyles[budget.status]}`}>
                                            {statusIcons[budget.status]}
                                            {budget.status}
                                        </span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${typeStyles[budget.type]}`}>
                                            {budget.type}
                                        </span>
                                    </div>

                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button className="p-1 -mr-1 text-muted-foreground hover:bg-secondary rounded transition-colors opacity-0 group-hover:opacity-100">
                                                <MoreVertical className="h-4 w-4" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" className="w-40 p-1">
                                            <button onClick={() => handleEdit(budget)} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary transition-colors flex items-center gap-2">
                                                <Edit className="h-3.5 w-3.5" /> Editar
                                            </button>
                                            <button onClick={() => deleteBudget(budget.id)} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2">
                                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                                            </button>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <h3 className="font-bold text-base mb-1 line-clamp-2 leading-tight" title={budget.title}>
                                    {budget.title}
                                </h3>

                                <div className="text-xs text-muted-foreground flex items-center gap-1 mb-4 line-clamp-1" title={getCompanyName(budget.companyId)}>
                                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                                    {getCompanyName(budget.companyId)}
                                </div>

                                <div className="mt-auto pt-4 border-t border-border flex justify-between items-end">
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <FileText className="h-3.5 w-3.5" /> {budget.items?.length || 0} itens
                                        </div>
                                        {budget.validity && (
                                            <div className="flex items-center gap-1" title="Validade">
                                                <Calendar className="h-3.5 w-3.5 text-primary/70" /> {budget.validity}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Total</p>
                                        <p className="font-bold text-primary text-lg leading-none tracking-tight">
                                            {formatCurrency(budget.totalValue)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <BudgetModal
                    budget={selectedBudget}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default BudgetsPage;
