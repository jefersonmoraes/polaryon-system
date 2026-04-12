import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { Plus, Trash2, CalendarClock } from 'lucide-react';
import { RecurringExpense } from '@/types/accounting';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function RecurringExpensesModal({ open, onOpenChange }: Props) {
    const { recurringExpenses, addRecurringExpense, deleteRecurringExpense, categories } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [categoryId, setCategoryId] = useState('');
    const [dayOfMonth, setDayOfMonth] = useState<number | ''>('');
    const [companyId, setCompanyId] = useState(mainCompanies.find(c => c.isDefault)?.id || mainCompanies[0]?.id || '');

    const expenseCategories = categories.filter(c => c.type === 'expense');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description || !amount || !categoryId || !dayOfMonth || !companyId) return;

        addRecurringExpense({
            companyId,
            description,
            amount: Number(amount),
            categoryId,
            dayOfMonth: Number(dayOfMonth),
            active: true
        });

        setDescription('');
        setAmount('');
        setDayOfMonth('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-card border-border text-foreground">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarClock className="h-5 w-5 text-primary" />
                        Despesas Recorrentes (Mensais)
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Add Form */}
                    <form onSubmit={handleAdd} className="bg-muted/10 border border-border rounded-xl p-4 flex flex-col gap-4">
                        <h4 className="text-sm font-bold">Nova Despesa Fixa</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Descrição</label>
                                <input
                                    required
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Ex: Aluguel"
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Valor (R$)</label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={e => setAmount(Number(e.target.value))}
                                    placeholder="0,00"
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Dia do Vencimento (1-31)</label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={dayOfMonth}
                                    onChange={e => setDayOfMonth(Number(e.target.value))}
                                    placeholder="Ex: 5"
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
                                <Select value={categoryId} onValueChange={setCategoryId}>
                                    <SelectTrigger className="w-full bg-background border border-border rounded-md px-3 h-10 text-sm focus:ring-1 focus:ring-primary font-bold">
                                        <SelectValue placeholder="Selecione a categoria" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card/95 backdrop-blur-xl border-border max-h-[250px]">
                                        {expenseCategories.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="text-xs font-bold">{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <button type="submit" className="w-full mt-2 bg-primary text-primary-foreground font-bold rounded-md py-2 flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
                            <Plus className="h-4 w-4" /> Adicionar Custo Fixo
                        </button>
                    </form>

                    {/* List */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-muted-foreground">Despesas Cadastradas</h4>
                        {recurringExpenses.length === 0 ? (
                            <div className="text-center p-6 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                                Nenhuma despesa recorrente cadastrada.
                            </div>
                        ) : (
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                                {recurringExpenses.map(expense => (
                                    <div key={expense.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg group">
                                        <div>
                                            <p className="font-bold text-sm text-foreground">{expense.description}</p>
                                            <p className="text-xs text-muted-foreground">Todo dia {expense.dayOfMonth} • {categories.find(c => c.id === expense.categoryId)?.name}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold text-rose-500">R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            <button
                                                onClick={() => deleteRecurringExpense(expense.id)}
                                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                                title="Remover"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
