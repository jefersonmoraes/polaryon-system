import { useState, useMemo, useEffect } from 'react';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { ArrowUpRight, ArrowDownRight, Edit, Trash2, ArrowLeft, Search, Filter, Calendar, Paperclip, Plus, ChevronDown, CalendarClock } from 'lucide-react';
import EntryFormModal from '@/components/accounting/EntryFormModal';
import RecurringExpensesModal from '@/components/accounting/RecurringExpensesModal';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { AccountingTrashViewer } from '@/components/accounting/AccountingTrashViewer';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const AccountingEntries = () => {
    const { entries, categories, deleteEntry, fetchAccountingData } = useAccountingStore();
    const { mainCompanies, fetchKanbanData } = useKanbanStore();

    useEffect(() => {
        fetchAccountingData();
        fetchKanbanData();
    }, [fetchAccountingData, fetchKanbanData]);

    const activeCompany = useMemo(() => mainCompanies.find((c) => c.isDefault) || mainCompanies[0], [mainCompanies]);

    const currentUser = useAuthStore(state => state.currentUser);

    const [modalOpen, setModalOpen] = useState(false);
    const [recurringModalOpen, setRecurringModalOpen] = useState(false);
    const [trashViewerOpen, setTrashViewerOpen] = useState(false);
    const [modalType, setModalType] = useState<'revenue' | 'expense'>('revenue');
    const [entryToEdit, setEntryToEdit] = useState<string | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState('');
    type FilterMode = 'current_month' | 'specific_month' | 'custom_period' | 'exact_period' | 'specific_year' | 'all';
    
    const [filterMode, setFilterMode] = useState<FilterMode>('current_month');
    const [exactStartDate, setExactStartDate] = useState<string>('');
    const [exactEndDate, setExactEndDate] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [startMonth, setStartMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [endMonth, setEndMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [showMobileActions, setShowMobileActions] = useState(false);

    const isDateInFilter = (dateStr: string) => {
        if (!dateStr) return false;
        const [yearStr, monthStr] = dateStr.split('T')[0].split('-');
        const dYear = parseInt(yearStr, 10);
        const dMonth = parseInt(monthStr, 10) - 1;

        const now = new Date();
        if (filterMode === 'current_month') {
            return dMonth === now.getMonth() && dYear === now.getFullYear();
        }
        if (filterMode === 'specific_month') {
            const [year, month] = selectedMonth.split('-');
            return dYear === parseInt(year) && dMonth === parseInt(month) - 1;
        }
        if (filterMode === 'custom_period') {
            if (!startMonth || !endMonth) return true;
            const [sYear, sMonth] = startMonth.split('-');
            const [eYear, eMonth] = endMonth.split('-');
            const startStr = `${sYear}-${sMonth}`;
            const endStr = `${eYear}-${eMonth}`;
            const targetStr = `${yearStr}-${monthStr}`;
            return targetStr >= startStr && targetStr <= endStr;
        }
        if (filterMode === 'exact_period') {
            if (!exactStartDate && !exactEndDate) return true;
            const targetStr = dateStr.split('T')[0];
            if (exactStartDate && targetStr < exactStartDate) return false;
            if (exactEndDate && targetStr > exactEndDate) return false;
            return true;
        }
        if (filterMode === 'specific_year') {
            return dYear === selectedYear;
        }
        return true;
    };

    const filteredEntries = useMemo(() => {
        const companyEntries = entries.filter(e => (!activeCompany || e.companyId === activeCompany.id) && !e.trashedAt);

        return companyEntries
            .filter(e => {
                const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    categories.find(c => c.id === e.categoryId)?.name.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesType = filterType === 'all' || e.type === filterType;
                const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
                const matchesCategory = filterCategory === 'all' || e.categoryId === filterCategory;
                const matchesDate = isDateInFilter(e.date);

                return matchesSearch && matchesType && matchesStatus && matchesCategory && matchesDate;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [entries, activeCompany?.id, categories, searchQuery, filterType, filterStatus, filterCategory, filterMode, selectedMonth, startMonth, endMonth, selectedYear, exactStartDate, exactEndDate]);

    const { totalRevenue, totalPendingRevenue, totalExpense, totalPendingExpense } = useMemo(() => {
        return {
            totalRevenue: filteredEntries.filter(e => e.type === 'revenue' && e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0),
            totalPendingRevenue: filteredEntries.filter(e => e.type === 'revenue' && e.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0),
            totalExpense: filteredEntries.filter(e => e.type === 'expense' && e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0),
            totalPendingExpense: filteredEntries.filter(e => e.type === 'expense' && e.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0)
        };
    }, [filteredEntries]);

    const handleEdit = (id: string, type: 'revenue' | 'expense') => {
        setModalType(type);
        setEntryToEdit(id);
        setModalOpen(true);
    };

    return (
        <div className="flex-1 bg-background text-foreground overflow-hidden flex flex-col">
            <div className="kanban-header h-12 flex items-center px-4 shrink-0 border-b border-border z-10 gap-4">
                <Link to="/contabil" className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-primary/10">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <h1 className="font-bold text-lg text-white truncate">LANÇAMENTOS CONTÁBEIS</h1>
                {activeCompany && (
                    <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-medium border border-accent/30 whitespace-nowrap hidden sm:inline-block">
                        {activeCompany.nomeFantasia || activeCompany.razaoSocial}
                    </span>
                )}
                <div className="ml-auto">
                    <button
                        onClick={() => setTrashViewerOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-background/20 hover:bg-rose-500/20 text-white hover:text-rose-400 rounded-md transition-colors text-sm font-medium border border-transparent hover:border-rose-500/30"
                    >
                        <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Lixeira</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar flex flex-col">
                <div className="max-w-6xl mx-auto w-full space-y-6 flex-1 flex flex-col">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="relative w-full max-w-md flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    placeholder="Buscar lançamentos..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`p-2 rounded-md border transition-colors ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:bg-muted/50'}`}
                                title="Filtros Avançados"
                            >
                                <Filter className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            {/* Desktop Buttons */}
                            <div className="hidden sm:flex gap-2">
                                <button
                                    onClick={() => setRecurringModalOpen(true)}
                                    disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                    className="px-4 py-2 bg-secondary text-foreground rounded-md text-sm font-bold hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2 border border-border shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <CalendarClock className="h-4 w-4" /> Despesas Fixas
                                </button>
                                <button
                                    onClick={() => { setModalType('revenue'); setEntryToEdit(undefined); setModalOpen(true); }}
                                    disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                    className="px-4 py-2 bg-emerald-500 text-white rounded-md text-sm font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ArrowUpRight className="h-4 w-4" /> Nova Entrada
                                </button>
                                <button
                                    onClick={() => { setModalType('expense'); setEntryToEdit(undefined); setModalOpen(true); }}
                                    disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                    className="px-4 py-2 bg-rose-500 text-white rounded-md text-sm font-bold hover:bg-rose-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ArrowDownRight className="h-4 w-4" /> Nova Saída
                                </button>
                            </div>

                            {/* Mobile Dropdown Button */}
                            <div className="sm:hidden relative w-full">
                                <button
                                    onClick={() => setShowMobileActions(!showMobileActions)}
                                    disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                    className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus className="h-4 w-4" /> Novo Lançamento <ChevronDown className="h-4 w-4 ml-1" />
                                </button>

                                {showMobileActions && (
                                    <>
                                        <div className="fixed inset-0 z-30" onClick={() => setShowMobileActions(false)} />
                                        <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-card border border-border rounded-lg shadow-xl overflow-hidden flex flex-col animate-in slide-in-from-top-2">
                                            <button
                                                onClick={() => { setRecurringModalOpen(true); setShowMobileActions(false); }}
                                                className="px-4 py-3 text-sm font-bold text-foreground hover:bg-muted flex items-center gap-2 border-b border-border/50 text-left"
                                            >
                                                <CalendarClock className="h-4 w-4" /> Gerenciar Despesas Fixas
                                            </button>
                                            <button
                                                onClick={() => { setModalType('revenue'); setEntryToEdit(undefined); setModalOpen(true); setShowMobileActions(false); }}
                                                className="px-4 py-3 text-sm font-bold text-emerald-500 hover:bg-muted flex items-center gap-2 border-b border-border/50 text-left"
                                            >
                                                <ArrowUpRight className="h-4 w-4" /> Registrar Nova Entrada
                                            </button>
                                            <button
                                                onClick={() => { setModalType('expense'); setEntryToEdit(undefined); setModalOpen(true); setShowMobileActions(false); }}
                                                className="px-4 py-3 text-sm font-bold text-rose-500 hover:bg-muted flex items-center gap-2 text-left"
                                            >
                                                <ArrowDownRight className="h-4 w-4" /> Registrar Nova Saída
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Filtros Avançados */}
                    {showFilters && (
                        <div className="bg-muted/10 border border-border rounded-xl p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                                <div className="flex flex-col sm:flex-row items-center gap-2 bg-background border border-border p-2 rounded-lg flex-1">
                                    <Filter className="h-4 w-4 text-muted-foreground mr-1" />
                                    <Select 
                                        value={filterMode} 
                                        onValueChange={(v) => setFilterMode(v as FilterMode)}
                                    >
                                        <SelectTrigger className="bg-transparent border-none shadow-none text-sm font-bold h-7 px-2 focus:ring-0 w-full sm:w-auto">
                                            <SelectValue placeholder="Período" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="current_month" className="text-xs font-bold">Mês Atual</SelectItem>
                                            <SelectItem value="specific_month" className="text-xs font-bold">Mês Específico</SelectItem>
                                            <SelectItem value="custom_period" className="text-xs font-bold">Vários Meses</SelectItem>
                                            <SelectItem value="exact_period" className="text-xs font-bold">Dias Específicos</SelectItem>
                                            <SelectItem value="specific_year" className="text-xs font-bold">Ano Específico</SelectItem>
                                            <SelectItem value="all" className="text-xs font-bold">Todo o Período</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {filterMode === 'specific_month' && (
                                        <input
                                            type="month"
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                            className="bg-background border border-border rounded-md text-sm px-2 py-1 focus:outline-none focus:border-primary w-full sm:w-auto mt-2 sm:mt-0"
                                        />
                                    )}

                                    {filterMode === 'custom_period' && (
                                        <div className="flex items-center gap-1 w-full sm:w-auto mt-2 sm:mt-0">
                                            <input
                                                type="month"
                                                value={startMonth}
                                                onChange={(e) => setStartMonth(e.target.value)}
                                                className="bg-background border border-border rounded-md text-sm px-2 py-1 focus:outline-none focus:border-primary w-full sm:w-32"
                                            />
                                            <span className="text-muted-foreground text-sm">até</span>
                                            <input
                                                type="month"
                                                value={endMonth}
                                                onChange={(e) => setEndMonth(e.target.value)}
                                                className="bg-background border border-border rounded-md text-sm px-2 py-1 focus:outline-none focus:border-primary w-full sm:w-32"
                                            />
                                        </div>
                                    )}

                                    {filterMode === 'exact_period' && (
                                        <div className="flex items-center gap-1 w-full sm:w-auto mt-2 sm:mt-0">
                                            <input
                                                type="date"
                                                value={exactStartDate}
                                                onChange={(e) => setExactStartDate(e.target.value)}
                                                className="bg-background border border-border rounded-md text-sm px-2 py-1 focus:outline-none focus:border-primary w-full sm:w-36"
                                            />
                                            <span className="text-muted-foreground text-sm">até</span>
                                            <input
                                                type="date"
                                                value={exactEndDate}
                                                onChange={(e) => setExactEndDate(e.target.value)}
                                                className="bg-background border border-border rounded-md text-sm px-2 py-1 focus:outline-none focus:border-primary w-full sm:w-36"
                                            />
                                        </div>
                                    )}

                                    {filterMode === 'specific_year' && (
                                        <input
                                            type="number"
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                            className="bg-background border border-border rounded-md text-sm px-2 py-1 focus:outline-none focus:border-primary w-full sm:w-24 mt-2 sm:mt-0"
                                            min="2000"
                                            max="2100"
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Tipo</label>
                                <Select value={filterType} onValueChange={setFilterType}>
                                    <SelectTrigger className="w-full bg-background border border-border rounded-md px-3 h-9 text-sm focus:ring-1 focus:ring-primary font-bold">
                                        <SelectValue placeholder="Tipo" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                        <SelectItem value="all" className="text-xs font-bold">Todos</SelectItem>
                                        <SelectItem value="revenue" className="text-xs font-bold">Entradas</SelectItem>
                                        <SelectItem value="expense" className="text-xs font-bold">Saídas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Status</label>
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger className="w-full bg-background border border-border rounded-md px-3 h-9 text-sm focus:ring-1 focus:ring-primary font-bold">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                        <SelectItem value="all" className="text-xs font-bold">Todos</SelectItem>
                                        <SelectItem value="paid" className="text-xs font-bold">Paga/Recebida</SelectItem>
                                        <SelectItem value="pending" className="text-xs font-bold">Pendente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Categoria</label>
                                <Select value={filterCategory} onValueChange={setFilterCategory}>
                                    <SelectTrigger className="w-full bg-background border border-border rounded-md px-3 h-9 text-sm focus:ring-1 focus:ring-primary font-bold">
                                        <SelectValue placeholder="Categoria" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card/95 backdrop-blur-xl border-border max-h-[300px]">
                                        <SelectItem value="all" className="text-xs font-bold">Todas as Categorias</SelectItem>
                                        {categories.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="text-xs font-bold">{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            </div>
                        </div>
                    )}

                    {/* Dashboard de Totais Filtrados */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-background border border-border rounded-xl p-4 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full -z-10 group-hover:bg-emerald-500/20 transition-colors"></div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1"><ArrowUpRight className="h-3 w-3 text-emerald-500" /> Entradas (Pagas)</p>
                            <p className="text-xl font-bold text-emerald-500">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="bg-background border border-border rounded-xl p-4 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-16 h-16 bg-amber-500/10 rounded-bl-full -z-10 group-hover:bg-amber-500/20 transition-colors"></div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1"><ArrowUpRight className="h-3 w-3 text-amber-500" /> Entradas (Pendentes)</p>
                            <p className="text-xl font-bold text-foreground">R$ {totalPendingRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="bg-background border border-border rounded-xl p-4 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-16 h-16 bg-rose-500/10 rounded-bl-full -z-10 group-hover:bg-rose-500/20 transition-colors"></div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1"><ArrowDownRight className="h-3 w-3 text-rose-500" /> Saídas (Pagas)</p>
                            <p className="text-xl font-bold text-rose-500">R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="bg-background border border-border rounded-xl p-4 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-16 h-16 bg-amber-500/10 rounded-bl-full -z-10 group-hover:bg-amber-500/20 transition-colors"></div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1"><ArrowDownRight className="h-3 w-3 text-amber-500" /> Saídas (Pendentes)</p>
                            <p className="text-xl font-bold text-foreground">R$ {totalPendingExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden bg-card/30">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-auto custom-scrollbar flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground bg-muted/30 sticky top-0 z-10 uppercase font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 min-w-[120px]">Data</th>
                                        <th className="px-4 py-3 min-w-[200px]">Título</th>
                                        <th className="px-4 py-3 min-w-[150px]">Categoria</th>
                                        <th className="px-4 py-3 min-w-[120px]">Status</th>
                                        <th className="px-4 py-3 text-right min-w-[150px]">Valor</th>
                                        <th className="px-4 py-3 text-center w-[100px]">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                                Nenhum lançamento encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map(entry => {
                                            const category = categories.find(c => c.id === entry.categoryId);
                                            return (
                                                <tr key={entry.id} className="hover:bg-muted/10 transition-colors group">
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {new Date(entry.date.includes('T') ? entry.date : entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-foreground">
                                                        <div className="flex items-center gap-2">
                                                            <span>{entry.title}</span>
                                                            {entry.attachments && entry.attachments.length > 0 && (
                                                                <span title={`${entry.attachments.length} anexo(s)`} className="flex items-center text-muted-foreground bg-secondary px-1.5 py-0.5 rounded text-[10px]">
                                                                    <Paperclip className="h-3 w-3 mr-1" /> {entry.attachments.length}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-[10px] font-medium border border-border">
                                                            {category?.name || 'Sem categoria'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${entry.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                            {entry.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${entry.type === 'revenue' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {entry.type === 'revenue' ? '+' : '-'} R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEdit(entry.id, entry.type)}
                                                                disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                                                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                title="Editar Lançamento"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('Tem certeza que deseja excluir este lançamento?')) {
                                                                        deleteEntry(entry.id);
                                                                    }
                                                                }}
                                                                disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                title="Excluir Lançamento"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden overflow-auto custom-scrollbar flex-1 p-2 space-y-3">
                            {filteredEntries.length === 0 ? (
                                <div className="px-4 py-8 text-center text-muted-foreground">
                                    Nenhum lançamento encontrado.
                                </div>
                            ) : (
                                filteredEntries.map(entry => {
                                    const category = categories.find(c => c.id === entry.categoryId);
                                    return (
                                        <div key={entry.id} className="bg-background border border-border rounded-lg p-3 shadow-sm flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(entry.date.includes('T') ? entry.date : entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                                    <h3 className="font-bold text-sm text-foreground leading-tight mt-0.5">{entry.title}</h3>
                                                </div>
                                                <div className={`text-sm font-bold ${entry.type === 'revenue' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {entry.type === 'revenue' ? '+' : '-'} R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between mt-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px] font-medium border border-border">
                                                        {category?.name || 'Sem categoria'}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${entry.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                        {entry.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                                                    </span>
                                                    {entry.attachments && entry.attachments.length > 0 && (
                                                        <span className="flex items-center text-muted-foreground bg-secondary px-1.5 py-0.5 rounded text-[10px]">
                                                            <Paperclip className="h-3 w-3 mr-1" /> {entry.attachments.length}
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleEdit(entry.id, entry.type)}
                                                        disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                                        className="p-1 text-muted-foreground hover:text-primary active:scale-95 transition-all text-sm font-medium flex items-center gap-1"
                                                    >
                                                        <Edit className="h-3.5 w-3.5" /> Editar
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Tem certeza que deseja excluir este lançamento?')) {
                                                                deleteEntry(entry.id);
                                                            }
                                                        }}
                                                        disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                                        className="p-1 text-rose-500/70 hover:text-rose-500 active:scale-95 transition-all text-sm font-medium flex items-center gap-1"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <EntryFormModal
                open={modalOpen}
                onOpenChange={(open) => {
                    setModalOpen(open);
                    if (!open) setEntryToEdit(undefined);
                }}
                type={modalType}
                existingEntryId={entryToEdit}
            />

            <RecurringExpensesModal
                open={recurringModalOpen}
                onOpenChange={setRecurringModalOpen}
            />

            <AccountingTrashViewer open={trashViewerOpen} onOpenChange={setTrashViewerOpen} />
        </div>
    );
};

export default AccountingEntries;
