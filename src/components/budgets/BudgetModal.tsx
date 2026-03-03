import { useState } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { Budget, BudgetStatus, BudgetType } from '@/types/kanban';
import {
    X, Plus, Calculator, Trash2, Building2, Calendar, FileText,
    CheckCircle2, Clock, XCircle, FileSearch, Save
} from 'lucide-react';

interface BudgetModalProps {
    budget?: Budget;
    onClose: () => void;
}

const statusColors: Record<BudgetStatus, string> = {
    Aguardando: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
    Cotado: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
    Aprovado: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
    Recusado: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
};

const statusIcons: Record<BudgetStatus, React.ReactNode> = {
    Aguardando: <Clock className="h-4 w-4" />,
    Cotado: <FileSearch className="h-4 w-4" />,
    Aprovado: <CheckCircle2 className="h-4 w-4" />,
    Recusado: <XCircle className="h-4 w-4" />,
};

const BudgetModal = ({ budget, onClose }: BudgetModalProps) => {
    const { addBudget, updateBudget, companies } = useKanbanStore();

    const [formData, setFormData] = useState<Partial<Budget>>(budget || {
        title: '',
        type: 'Produto',
        status: 'Aguardando',
        companyId: '',
        items: [],
        totalValue: 0,
        validity: '',
        notes: ''
    });

    const calculateTotal = (items: any[]) => {
        return items.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
    };

    const addItem = () => {
        const newItem = {
            id: crypto.randomUUID(),
            description: '',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0
        };
        const newItems = [...(formData.items || []), newItem];
        setFormData(prev => ({
            ...prev,
            items: newItems,
            totalValue: calculateTotal(newItems)
        }));
    };

    const updateItem = (id: string, field: string, value: any) => {
        const newItems = (formData.items || []).map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                if (field === 'quantity' || field === 'unitPrice') {
                    updated.totalPrice = Number(updated.quantity || 0) * Number(updated.unitPrice || 0);
                }
                return updated;
            }
            return item;
        });

        setFormData(prev => ({
            ...prev,
            items: newItems,
            totalValue: calculateTotal(newItems)
        }));
    };

    const removeItem = (id: string) => {
        const newItems = (formData.items || []).filter(item => item.id !== id);
        setFormData(prev => ({
            ...prev,
            items: newItems,
            totalValue: calculateTotal(newItems)
        }));
    };

    const handleSave = () => {
        if (!formData.title) return; // Basic validation

        if (budget) {
            updateBudget(budget.id, formData);
        } else {
            addBudget(formData as Omit<Budget, 'id' | 'createdAt'>);
        }
        onClose();
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-background w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] border border-border overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-card">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-primary/10 text-primary`}>
                            <Calculator className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{budget ? 'Editar Orçamento' : 'Novo Orçamento'}</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Gerencie os detalhes do seu orçamento</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Left Column (Main Info) */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-border pb-2">
                                    <FileText className="h-4 w-4 text-primary" /> Informações Básicas
                                </h3>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Título do Orçamento</label>
                                    <input
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="Ex: Aquisição de Computadores Desktop"
                                        className="w-full bg-secondary border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</label>
                                        <select
                                            value={formData.type}
                                            onChange={e => setFormData({ ...formData, type: e.target.value as BudgetType })}
                                            className="w-full bg-secondary border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                        >
                                            <option value="Produto">Produto</option>
                                            <option value="Serviço">Serviço</option>
                                            <option value="Frete">Frete</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={e => setFormData({ ...formData, status: e.target.value as BudgetStatus })}
                                            className="w-full bg-secondary border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                        >
                                            <option value="Aguardando">Aguardando</option>
                                            <option value="Cotado">Cotado</option>
                                            <option value="Aprovado">Aprovado</option>
                                            <option value="Recusado">Recusado</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-border pb-2">
                                    <h3 className="text-sm font-semibold flex items-center gap-2">
                                        <Calculator className="h-4 w-4 text-primary" /> Itens do Orçamento
                                    </h3>
                                    <button onClick={addItem} className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1">
                                        <Plus className="h-3.5 w-3.5" /> Adicionar Item
                                    </button>
                                </div>

                                {formData.items?.length === 0 ? (
                                    <div className="text-center py-8 bg-secondary/50 rounded-lg border border-dashed border-border">
                                        <Calculator className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                        <p className="text-sm text-muted-foreground">Nenhum item adicionado a este orçamento.</p>
                                        <button onClick={addItem} className="mt-3 text-xs font-medium text-primary hover:underline">
                                            Adicionar o primeiro item
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                                            <div className="col-span-1 border-r border-border/50 text-center">#</div>
                                            <div className="col-span-5">Descrição</div>
                                            <div className="col-span-2 text-right">Qtd</div>
                                            <div className="col-span-2 text-right">V. Unit</div>
                                            <div className="col-span-2 text-right pr-6">Total</div>
                                        </div>
                                        {formData.items?.map((item, idx) => (
                                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-secondary/50 p-2 rounded-lg border border-border group">
                                                <div className="col-span-1 text-[10px] text-muted-foreground text-center font-medium border-r border-border/50">
                                                    {String(idx + 1).padStart(2, '0')}
                                                </div>
                                                <div className="col-span-5 relative">
                                                    <input
                                                        value={item.description}
                                                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                                                        placeholder="Descrição do item..."
                                                        className="w-full bg-transparent border-none text-xs px-1 py-1 focus:ring-1 focus:ring-primary/20 rounded outline-none"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity || ''}
                                                        onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                                                        className="w-full bg-background border border-border/50 rounded text-xs px-2 py-1 focus:ring-1 focus:ring-primary/20 outline-none text-right font-mono"
                                                    />
                                                </div>
                                                <div className="col-span-2 relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={item.unitPrice || ''}
                                                        onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                                                        className="w-full bg-background border border-border/50 rounded text-xs pl-6 pr-2 py-1 focus:ring-1 focus:ring-primary/20 outline-none text-right font-mono"
                                                    />
                                                </div>
                                                <div className="col-span-2 text-right text-xs font-mono font-bold text-primary flex justify-between items-center pl-1">
                                                    <span className="truncate">{formatCurrency(item.totalPrice)}</span>
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Remover Item"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="flex justify-end pt-4 border-t border-border mt-4">
                                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 w-64">
                                                <div className="flex justify-between items-center text-sm mb-1">
                                                    <span className="text-muted-foreground">Subtotal</span>
                                                    <span>{formatCurrency(formData.totalValue || 0)}</span>
                                                </div>
                                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-primary/10">
                                                    <span className="font-bold uppercase text-xs tracking-wider">Total</span>
                                                    <span className="text-xl font-bold tracking-tight text-primary">
                                                        {formatCurrency(formData.totalValue || 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column (Side Info) */}
                        <div className="space-y-6">
                            <div className="bg-secondary/30 p-4 rounded-xl border border-border space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-border/50 pb-2">
                                    <Building2 className="h-4 w-4 text-primary" /> Empresa / Fornecedor
                                </h3>

                                <div className="space-y-2">
                                    <select
                                        value={formData.companyId || ''}
                                        onChange={e => setFormData({ ...formData, companyId: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    >
                                        <option value="">Selecione uma empresa...</option>
                                        {companies.filter(c => !c.trashed).map(c => (
                                            <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-secondary/30 p-4 rounded-xl border border-border space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-border/50 pb-2">
                                    <Calendar className="h-4 w-4 text-primary" /> Validade
                                </h3>

                                <div className="space-y-2">
                                    <input
                                        value={formData.validity || ''}
                                        onChange={e => setFormData({ ...formData, validity: e.target.value })}
                                        placeholder="Ex: 15 dias, 30/12/2026..."
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="bg-secondary/30 p-4 rounded-xl border border-border space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-border/50 pb-2">
                                    <FileText className="h-4 w-4 text-primary" /> Observações
                                </h3>

                                <div className="space-y-2">
                                    <textarea
                                        value={formData.notes || ''}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Condições de pagamento, frete incluso, etc..."
                                        rows={4}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none custom-scrollbar"
                                    />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-border bg-card flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!formData.title}
                        className="px-6 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-primary/20"
                    >
                        <Save className="h-4 w-4" />
                        Salvar Orçamento
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BudgetModal;
