import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAccountingStore } from '@/store/accounting-store';
import { EntryType, AccountingCategory } from '@/types/accounting';
import { useKanbanStore } from '@/store/kanban-store';
import { toast } from 'sonner';

interface EntryFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: EntryType;
    onSuccess?: () => void;
    existingEntryId?: string;
}

const EntryFormModal = ({ open, onOpenChange, type, onSuccess, existingEntryId }: EntryFormModalProps) => {
    const { addEntry, updateEntry, entries, categories } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    const typeCategories = categories.filter(c => c.type === type);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        amount: '',
        categoryId: typeCategories.length > 0 ? typeCategories[0].id : '',
        date: new Date().toISOString().split('T')[0],
        status: 'paid' as 'pending' | 'paid' | 'overdue',
    });

    useEffect(() => {
        if (open) {
            if (existingEntryId) {
                const entry = entries.find(e => e.id === existingEntryId);
                if (entry) {
                    setFormData({
                        title: entry.title,
                        description: entry.description || '',
                        amount: entry.amount.toFixed(2).replace('.', ','),
                        categoryId: entry.categoryId,
                        date: new Date(entry.date).toISOString().split('T')[0],
                        status: entry.status,
                    });
                }
            } else {
                setFormData({
                    title: '',
                    description: '',
                    amount: '',
                    categoryId: categories.find(c => c.type === type)?.id || '',
                    date: new Date().toISOString().split('T')[0],
                    status: 'paid',
                });
            }
        }
    }, [open, existingEntryId, type, categories]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCompany) {
            toast.error('Nenhuma empresa ativa selecionada');
            return;
        }

        if (!formData.title || !formData.amount || !formData.categoryId) {
            toast.error('Preencha os campos obrigatórios');
            return;
        }

        // Convert BRL format to number (e.g. 1.234,56 -> 1234.56)
        const cleanAmount = formData.amount.replace(/\./g, '').replace(',', '.');
        const numericAmount = parseFloat(cleanAmount);

        if (isNaN(numericAmount) || numericAmount <= 0) {
            toast.error('Valor inválido');
            return;
        }

        const entryData = {
            companyId: activeCompany.id,
            title: formData.title,
            description: formData.description,
            amount: numericAmount,
            categoryId: formData.categoryId,
            date: new Date(formData.date).toISOString(),
            status: formData.status,
            type: type,
        };

        if (existingEntryId) {
            updateEntry(existingEntryId, entryData);
            toast.success(`Lançamento atualizado com sucesso!`);
        } else {
            addEntry(entryData);
            toast.success(`${type === 'revenue' ? 'Receita' : 'Despesa'} registrada com sucesso!`);
        }

        // Reset form
        setFormData({
            title: '',
            description: '',
            amount: '',
            categoryId: typeCategories.length > 0 ? typeCategories[0].id : '',
            date: new Date().toISOString().split('T')[0],
            status: 'paid',
        });

        onOpenChange(false);
        if (onSuccess) onSuccess();
    };

    const isRevenue = type === 'revenue';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-background border border-border text-foreground">
                <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${isRevenue ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {existingEntryId ? (isRevenue ? 'Editar Entrada (Receita)' : 'Editar Saída (Despesa)') : (isRevenue ? 'Nova Entrada (Receita)' : 'Nova Saída (Despesa)')}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Título / Descrição Curta*</label>
                        <input
                            required
                            autoFocus
                            value={formData.title}
                            onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                            placeholder={isRevenue ? "Ex: Venda Produto X" : "Ex: Conta de Luz"}
                            className="w-full bg-secondary/50 border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Valor (R$)*</label>
                            <input
                                required
                                value={formData.amount}
                                onChange={(e) => {
                                    // Only allow numbers and comma
                                    const val = e.target.value.replace(/[^0-9,]/g, '');
                                    setFormData(p => ({ ...p, amount: val }));
                                }}
                                placeholder="0,00"
                                className="w-full bg-secondary/50 border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Data da Operação*</label>
                            <input
                                required
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                                className="w-full bg-secondary/50 border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Categoria Contábil*</label>
                        <select
                            required
                            value={formData.categoryId}
                            onChange={(e) => setFormData(p => ({ ...p, categoryId: e.target.value }))}
                            className="w-full bg-secondary/50 border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                        >
                            <option value="" disabled>Selecione uma categoria...</option>
                            {typeCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Status do Pagamento</label>
                        <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, status: 'paid' }))}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${formData.status === 'paid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Liquidado/Pago
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, status: 'pending' }))}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${formData.status === 'pending' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Pendente
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-2 border-t border-border">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${isRevenue ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'} text-white`}
                        >
                            {existingEntryId ? 'Atualizar' : `Registrar ${isRevenue ? 'Entrada' : 'Saída'}`}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default EntryFormModal;
