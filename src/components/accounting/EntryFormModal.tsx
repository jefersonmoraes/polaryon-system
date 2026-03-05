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
    const { addEntry, updateEntry, entries, categories, bankAccounts } = useAccountingStore();
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
        documentNumber: '',
        documentEntity: '',
        documentEntityId: '',
        competenceDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'bank_transfer' as any,
        bankAccountId: '',
        notes: ''
    });

    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceFrequency, setRecurrenceFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
    const [recurrenceCount, setRecurrenceCount] = useState(2);

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
                        documentNumber: entry.documentNumber || '',
                        documentEntity: entry.documentEntity || '',
                        documentEntityId: entry.documentEntityId || '',
                        competenceDate: entry.competenceDate ? new Date(entry.competenceDate).toISOString().split('T')[0] : new Date(entry.date).toISOString().split('T')[0],
                        paymentMethod: entry.paymentMethod || 'bank_transfer',
                        bankAccountId: entry.bankAccountId || '',
                        notes: entry.notes || ''
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
                    documentNumber: '',
                    documentEntity: '',
                    documentEntityId: '',
                    competenceDate: new Date().toISOString().split('T')[0],
                    paymentMethod: 'bank_transfer',
                    bankAccountId: '',
                    notes: ''
                });
                setIsRecurring(false);
                setRecurrenceFrequency('monthly');
                setRecurrenceCount(2);
            }
        }
    }, [open, existingEntryId, type, categories]);

    const calculateNextDate = (baseDateStr: string, frequency: string, iteration: number): string => {
        // Usa T12:00:00 para evitar mudanças de dia por fuso horário
        const dateObj = new Date(baseDateStr + 'T12:00:00');
        if (frequency === 'monthly') {
            dateObj.setMonth(dateObj.getMonth() + iteration);
        } else if (frequency === 'weekly') {
            dateObj.setDate(dateObj.getDate() + (iteration * 7));
        } else if (frequency === 'yearly') {
            dateObj.setFullYear(dateObj.getFullYear() + iteration);
        }
        return dateObj.toISOString();
    };

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
            documentNumber: formData.documentNumber,
            documentEntity: formData.documentEntity,
            documentEntityId: formData.documentEntityId?.replace(/\D/g, ''),
            competenceDate: new Date(formData.competenceDate).toISOString(),
            paymentMethod: formData.paymentMethod,
            bankAccountId: formData.bankAccountId || undefined,
            notes: formData.notes
        };

        if (existingEntryId) {
            updateEntry(existingEntryId, entryData);
            toast.success(`Lançamento atualizado com sucesso!`);
        } else {
            if (isRecurring && recurrenceCount > 1) {
                for (let i = 0; i < recurrenceCount; i++) {
                    const nextDateStr = calculateNextDate(formData.date, recurrenceFrequency, i);

                    const recurringEntryData = {
                        ...entryData,
                        title: `${formData.title} (${i + 1}/${recurrenceCount})`,
                        date: nextDateStr,
                        // Força como pendente as próximas parcelas, caso a primeira seja paga
                        status: i === 0 ? formData.status : 'pending',
                    };
                    addEntry(recurringEntryData as typeof entryData);
                }
                toast.success(`${recurrenceCount} parcelas de ${type === 'revenue' ? 'Receita' : 'Despesa'} registradas com sucesso!`);
            } else {
                addEntry(entryData);
                toast.success(`${type === 'revenue' ? 'Receita' : 'Despesa'} registrada com sucesso!`);
            }
        }

        // Reset form
        setFormData({
            title: '',
            description: '',
            amount: '',
            categoryId: typeCategories.length > 0 ? typeCategories[0].id : '',
            date: new Date().toISOString().split('T')[0],
            status: 'paid',
            documentNumber: '',
            documentEntity: '',
            documentEntityId: '',
            competenceDate: new Date().toISOString().split('T')[0],
            paymentMethod: 'bank_transfer',
            bankAccountId: '',
            notes: ''
        });

        onOpenChange(false);
        if (onSuccess) onSuccess();
    };

    const isRevenue = type === 'revenue';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] bg-background border border-border text-foreground max-h-[90vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${isRevenue ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {existingEntryId ? (isRevenue ? 'Editar Entrada (Receita)' : 'Editar Saída (Despesa)') : (isRevenue ? 'Nova Entrada (Receita)' : 'Nova Saída (Despesa)')}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 mt-2">
                    {/* Sessão: Informações Básicas */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold border-b border-border pb-1">Informações Básicas</h4>
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
                                        const val = e.target.value.replace(/[^0-9,]/g, '');
                                        setFormData(p => ({ ...p, amount: val }));
                                    }}
                                    placeholder="0,00"
                                    className="w-full bg-secondary/50 border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors font-mono"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">Categoria Contábil*</label>
                                <select
                                    required
                                    value={formData.categoryId}
                                    onChange={(e) => setFormData(p => ({ ...p, categoryId: e.target.value }))}
                                    className="w-full bg-background text-foreground border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                                >
                                    <option className="bg-background text-foreground" value="" disabled>Selecione uma categoria...</option>
                                    {typeCategories.map(cat => (
                                        <option className="bg-background text-foreground" key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Sessão: Auditoria e Conformidade Legal */}
                    <div className="space-y-4 bg-muted/20 p-3 rounded-xl border border-border/50">
                        <h4 className="text-sm font-bold border-b border-border/50 pb-1 text-primary">Auditoria e Conformidade (Opcional)</h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-semibold uppercase text-muted-foreground">CPF/CNPJ do {isRevenue ? 'Cliente' : 'Fornecedor'}</label>
                                <input
                                    value={formData.documentEntityId}
                                    onChange={(e) => setFormData(p => ({ ...p, documentEntityId: e.target.value }))}
                                    placeholder="00.000.000/0000-00"
                                    className="w-full bg-secondary/30 border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Nome da Entidade</label>
                                <input
                                    value={formData.documentEntity}
                                    onChange={(e) => setFormData(p => ({ ...p, documentEntity: e.target.value }))}
                                    placeholder={isRevenue ? "Nome do Cliente/Órgão" : "Nome do Fornecedor"}
                                    className="w-full bg-secondary/30 border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Nº do Documento (NF/Fatura)</label>
                                <input
                                    value={formData.documentNumber}
                                    onChange={(e) => setFormData(p => ({ ...p, documentNumber: e.target.value }))}
                                    placeholder="Ex: NF-1234"
                                    className="w-full bg-secondary/30 border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Forma de Pagamento</label>
                                <select
                                    value={formData.paymentMethod}
                                    onChange={(e) => setFormData(p => ({ ...p, paymentMethod: e.target.value as any }))}
                                    className="w-full bg-background text-foreground border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                                >
                                    <option className="bg-background text-foreground" value="pix">PIX</option>
                                    <option className="bg-background text-foreground" value="bank_transfer">Transferência Bancária (TED/DOC)</option>
                                    <option className="bg-background text-foreground" value="boleto">Boleto Bancário</option>
                                    <option className="bg-background text-foreground" value="credit_card">Cartão de Crédito</option>
                                    <option className="bg-background text-foreground" value="debit_card">Cartão de Débito</option>
                                    <option className="bg-background text-foreground" value="cash">Dinheiro em Espécie</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Instituição Financeira (Conta)</label>
                            <select
                                value={formData.bankAccountId}
                                onChange={(e) => setFormData(p => ({ ...p, bankAccountId: e.target.value }))}
                                className="w-full bg-background text-foreground border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                            >
                                <option className="bg-background text-foreground" value="">Sem vínculo / Caixa Interno</option>
                                {bankAccounts.filter(b => b.companyId === activeCompany?.id).map(bank => (
                                    <option className="bg-background text-foreground" key={bank.id} value={bank.id}>{bank.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Data de Competência (Fato Gerador)</label>
                            <input
                                type="date"
                                value={formData.competenceDate}
                                onChange={(e) => setFormData(p => ({ ...p, competenceDate: e.target.value }))}
                                className="w-full bg-secondary/30 border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"
                                title="Data em que o serviço foi prestado ou produto entregue, independente do pagamento."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Observações / Centro de Custo</label>
                            <textarea
                                rows={2}
                                value={formData.notes}
                                onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                                placeholder="Anotações para contabilidade..."
                                className="w-full bg-secondary/30 border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary resize-none custom-scrollbar"
                            />
                        </div>
                    </div>

                    {/* Sessão: Liquidação */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold border-b border-border pb-1">Liquidação / Pagamento</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">Data do Caixa (Pagto/Recto)*</label>
                                <input
                                    required
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                                    className="w-full bg-secondary/50 border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">Status do Pagamento</label>
                                <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, status: 'paid' }))}
                                        className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${formData.status === 'paid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Liquidado
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, status: 'pending' }))}
                                        className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${formData.status === 'pending' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Pendente
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {!existingEntryId && (
                        <div className="bg-secondary/20 border border-border rounded-lg p-3 space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isRecurring}
                                    onChange={(e) => setIsRecurring(e.target.checked)}
                                    className="rounded border-border text-primary focus:ring-primary"
                                />
                                <span className="text-sm font-medium">Lançamento Recorrente / Parcelado?</span>
                            </label>

                            {isRecurring && (
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground">Frequência</label>
                                        <select
                                            value={recurrenceFrequency}
                                            onChange={(e) => setRecurrenceFrequency(e.target.value as any)}
                                            className="w-full bg-background text-foreground border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                                        >
                                            <option className="bg-background text-foreground" value="weekly">Semanal</option>
                                            <option className="bg-background text-foreground" value="monthly">Mensal</option>
                                            <option className="bg-background text-foreground" value="yearly">Anual</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground">Quantas vezes?</label>
                                        <input
                                            type="number"
                                            min="2"
                                            max="120"
                                            value={recurrenceCount}
                                            onChange={(e) => setRecurrenceCount(parseInt(e.target.value) || 2)}
                                            className="w-full bg-secondary/50 border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
