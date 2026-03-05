import { useState } from 'react';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { ArrowUpRight, ArrowDownRight, Edit, Trash2, ArrowLeft, Search } from 'lucide-react';
import EntryFormModal from '@/components/accounting/EntryFormModal';
import { Link } from 'react-router-dom';

const AccountingEntries = () => {
    const { entries, categories, deleteEntry } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'revenue' | 'expense'>('revenue');
    const [entryToEdit, setEntryToEdit] = useState<string | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState('');

    const companyEntries = entries.filter(e => e.companyId === activeCompany?.id);

    const filteredEntries = companyEntries
        .filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            categories.find(c => c.id === e.categoryId)?.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar flex flex-col">
                <div className="max-w-6xl mx-auto w-full space-y-6 flex-1 flex flex-col">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                placeholder="Buscar lançamentos..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button
                                onClick={() => { setModalType('revenue'); setEntryToEdit(undefined); setModalOpen(true); }}
                                className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 text-white rounded-md text-sm font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <ArrowUpRight className="h-4 w-4" /> Nova Entrada
                            </button>
                            <button
                                onClick={() => { setModalType('expense'); setEntryToEdit(undefined); setModalOpen(true); }}
                                className="flex-1 sm:flex-none px-4 py-2 bg-rose-500 text-white rounded-md text-sm font-bold hover:bg-rose-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <ArrowDownRight className="h-4 w-4" /> Nova Saída
                            </button>
                        </div>
                    </div>

                    <div className="kanban-card rounded-xl border border-border shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="overflow-auto custom-scrollbar flex-1">
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
                                                        {new Date(entry.date).toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-foreground">
                                                        {entry.title}
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
                                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEdit(entry.id, entry.type)}
                                                                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
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
                                                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
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
        </div>
    );
};

export default AccountingEntries;
