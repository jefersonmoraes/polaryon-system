import { useState, useRef, useEffect } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { Budget, BudgetStatus, BudgetType, BudgetItem, QuotationSubItem } from '@/types/kanban';
import {
    X, Plus, Calculator, Trash2, Building2, Calendar, FileText,
    CheckCircle2, Clock, XCircle, FileSearch, Save, Link as LinkIcon, Truck, Search, ChevronsUpDown, ChevronDown, ChevronUp
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

interface QuotationItemCardProps {
    item: any;
    idx: number;
    updateItem: (id: string, field: string, value: any) => void;
    removeItem: (id: string) => void;
    cloneItem: (id: string) => void;
    formatCurrency: (val: number) => string;
    companies: any[];
}

const QuotationItemCard = ({ item, idx, updateItem, removeItem, cloneItem, formatCurrency, companies }: QuotationItemCardProps) => {
    const [supplierSearch, setSupplierSearch] = useState('');
    const [transporterSearch, setTransporterSearch] = useState('');
    const [isSupplierOpen, setIsSupplierOpen] = useState(false);
    const [isTransporterOpen, setIsTransporterOpen] = useState(false);

    // Inicia recolhido como padrão
    const [isExpanded, setIsExpanded] = useState(false);

    const supRef = useRef<HTMLDivElement>(null);
    const transRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (supRef.current && !supRef.current.contains(event.target as Node)) setIsSupplierOpen(false);
            if (transRef.current && !transRef.current.contains(event.target as Node)) setIsTransporterOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredSuppliers = companies.filter(c => !c.trashed && c.type === 'Fornecedor' &&
        (c.nome_fantasia?.toLowerCase().includes(supplierSearch.toLowerCase()) || c.razao_social.toLowerCase().includes(supplierSearch.toLowerCase())));

    const filteredTransporters = companies.filter(c => !c.trashed && c.type === 'Transportadora' &&
        (c.nome_fantasia?.toLowerCase().includes(transporterSearch.toLowerCase()) || c.razao_social.toLowerCase().includes(transporterSearch.toLowerCase())));

    const supplierParams = companies.find(c => c.id === item.companyId);
    const supplierName = supplierParams ? (supplierParams.nome_fantasia || supplierParams.razao_social) : "Sem fornecedor";

    const addSubItem = () => {
        const newSubItem = {
            id: crypto.randomUUID(),
            description: '',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0
        };
        const newItems = [...(item.items || []), newSubItem];
        updateItem(item.id, 'items', newItems);
    };

    const recalculateTotal = (currentItems: QuotationSubItem[], freight: number, discountPercent: number, isDiscountActive: boolean) => {
        const productsTotal = currentItems.reduce((sum: number, sub: any) => sum + (sub.totalPrice || 0), 0);
        let baseTotal = productsTotal + freight;

        if (isDiscountActive && discountPercent > 0) {
            baseTotal -= baseTotal * (discountPercent / 100);
        }

        // Corrige bugs de Float Javascript impedindo ficar negativo
        return Math.max(0, baseTotal);
    };

    const updateSubItem = (subId: string, field: string, value: any) => {
        const newItems = (item.items || []).map((sub: any) => {
            if (sub.id === subId) {
                const updated = { ...sub, [field]: value };
                if (field === 'quantity' || field === 'unitPrice') {
                    updated.totalPrice = Number(updated.quantity || 0) * Number(updated.unitPrice || 0);
                }
                return updated;
            }
            return sub;
        });

        updateItem(item.id, 'items', newItems);

        const newTotal = recalculateTotal(
            newItems,
            Number(item.freightValue || 0),
            Number(item.cashDiscount || 0),
            !!item.hasCashDiscount
        );
        setTimeout(() => { updateItem(item.id, 'totalPrice', newTotal); }, 0);
    };

    const handleFreightChange = (newFreightValue: string) => {
        const numericFreight = Number(newFreightValue);
        updateItem(item.id, 'freightValue', numericFreight);

        const newTotal = recalculateTotal(
            item.items || [],
            numericFreight,
            Number(item.cashDiscount || 0),
            !!item.hasCashDiscount
        );
        setTimeout(() => updateItem(item.id, 'totalPrice', newTotal), 0);
    };

    const removeSubItem = (subId: string) => {
        const newItems = (item.items || []).filter((sub: any) => sub.id !== subId);
        updateItem(item.id, 'items', newItems);

        const newTotal = recalculateTotal(
            newItems,
            Number(item.freightValue || 0),
            Number(item.cashDiscount || 0),
            !!item.hasCashDiscount
        );
        setTimeout(() => { updateItem(item.id, 'totalPrice', newTotal); }, 0);
    };

    // Helper to generic field update that impacts Total
    const handleFieldChangeImpactingTotal = (field: keyof BudgetItem, value: any) => {
        updateItem(item.id, field, value);

        // Crie um clone virtual da proposta simulando o campo atualizado para injetar no recalculo
        const virtualItem = { ...item, [field]: value };

        const newTotal = recalculateTotal(
            virtualItem.items || [],
            Number(virtualItem.freightValue || 0),
            Number(virtualItem.cashDiscount || 0),
            !!virtualItem.hasCashDiscount
        );
        setTimeout(() => { updateItem(item.id, 'totalPrice', newTotal); }, 0);
    }

    return (
        <div className="bg-secondary/30 rounded-xl border border-border group relative flex flex-col transition-all overflow-hidden">
            {/* ... Header and Toggle are unchanged ... */}
            <div
                className={`p-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between cursor-pointer hover:bg-secondary/50 transition-colors ${isExpanded ? 'border-b border-border/50 bg-secondary/20' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-1 rounded">
                        #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <div>
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); updateItem(item.id, 'isFavorite', !item.isFavorite); }}
                                className={`transition-all hover:scale-125 focus:outline-none ${item.isFavorite ? 'text-yellow-500 drop-shadow-md' : 'text-muted-foreground/30 hover:text-yellow-500/50'}`}
                                title={item.isFavorite ? "Remover Favorito" : "Tornar Vencedora (Favorita)"}
                            >
                                ★
                            </button>
                            <Building2 className="h-4 w-4 text-primary" />
                            {supplierName}
                        </h4>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span>{(item.items || []).length} {((item.items || []).length === 1) ? 'item' : 'itens'} na cotação</span>
                            {item.freightValue ? (
                                <>
                                    <span>•</span>
                                    <span className="text-primary/70 flex items-center gap-0.5"><Truck className="h-3 w-3" /> Frete: R$ {item.freightValue}</span>
                                </>
                            ) : null}
                        </p>
                    </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-border/50 sm:border-0">
                    <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Fornecedor</span>
                        <span className="text-sm font-mono font-bold text-primary">{formatCurrency(item.totalPrice || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {item.isFavorite && (
                            <span className="text-[10px] tracking-widest text-yellow-600 bg-yellow-500/10 px-2 font-bold py-1 uppercase rounded-full mr-2">
                                Escolha
                            </span>
                        )}
                        <div className="p-1 rounded-full hover:bg-secondary/80 text-muted-foreground cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Body */}
            {isExpanded && (
                <div className="p-4 flex flex-col gap-5 animate-in fade-in slide-in-from-top-2 duration-200">

                    {/* Basic Companies Link */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 relative" ref={supRef}>
                            <label className="text-[10px] uppercase tracking-wider font-bold flex items-center justify-between text-muted-foreground">
                                <span>Fornecedor</span>
                                <div className="flex items-center gap-0.5" title="Avaliação da Empresa">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button key={star} onClick={() => updateItem(item.id, 'supplierRating', star)} className={`text-sm outline-none transition-colors hover:scale-110 ${item.supplierRating && item.supplierRating >= star ? 'text-yellow-500' : 'text-muted-foreground/30 hover:text-yellow-500/50'}`}>★</button>
                                    ))}
                                </div>
                            </label>
                            <button
                                onClick={() => setIsSupplierOpen(!isSupplierOpen)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary/20 outline-none"
                            >
                                <span className="truncate">{supplierName}</span>
                                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                            </button>
                            {isSupplierOpen && (
                                <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                                    <div className="p-2 border-b border-border flex items-center gap-2">
                                        <Search className="h-4 w-4 text-muted-foreground opacity-50 shrink-0" />
                                        <input autoFocus value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} placeholder="Buscar fornecedor..." className="w-full bg-transparent text-sm outline-none" />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                                        <button onClick={() => { updateItem(item.id, 'companyId', undefined); setIsSupplierOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary">Nenhum</button>
                                        {filteredSuppliers.map(c => (
                                            <button key={c.id} onClick={() => { updateItem(item.id, 'companyId', c.id); setIsSupplierOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary truncate">
                                                {c.nome_fantasia || c.razao_social}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 relative" ref={transRef}>
                            <label className="text-[10px] uppercase tracking-wider font-bold flex items-center justify-between text-muted-foreground">
                                <span>Transportadora</span>
                                <div className="flex items-center gap-0.5" title="Avaliação da Transportadora">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button key={star} onClick={() => updateItem(item.id, 'transporterRating', star)} className={`text-sm outline-none transition-colors hover:scale-110 ${item.transporterRating && item.transporterRating >= star ? 'text-yellow-500' : 'text-muted-foreground/30 hover:text-yellow-500/50'}`}>★</button>
                                    ))}
                                </div>
                            </label>
                            <button
                                onClick={() => setIsTransporterOpen(!isTransporterOpen)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary/20 outline-none"
                            >
                                <span className="truncate">
                                    {item.transporterId
                                        ? (companies.find(c => c.id === item.transporterId)?.nome_fantasia || companies.find(c => c.id === item.transporterId)?.razao_social)
                                        : "Nenhuma (FOB / Incluso)"}
                                </span>
                                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                            </button>
                            {isTransporterOpen && (
                                <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                                    <div className="p-2 border-b border-border flex items-center gap-2">
                                        <Search className="h-4 w-4 text-muted-foreground opacity-50 shrink-0" />
                                        <input autoFocus value={transporterSearch} onChange={e => setTransporterSearch(e.target.value)} placeholder="Buscar transportadora..." className="w-full bg-transparent text-sm outline-none" />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                                        <button onClick={() => { updateItem(item.id, 'transporterId', undefined); setIsTransporterOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary">Nenhuma</button>
                                        {filteredTransporters.map(c => (
                                            <button key={c.id} onClick={() => { updateItem(item.id, 'transporterId', c.id); setIsTransporterOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary truncate">
                                                {c.nome_fantasia || c.razao_social}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Grid of Negotiation Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 bg-card border border-border/50 rounded-lg p-3 shadow-sm">

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Valor do Frete</label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.freightValue || ''}
                                    onChange={e => handleFreightChange(e.target.value)}
                                    placeholder="CIF..."
                                    className="w-full bg-background border border-border rounded text-xs pl-7 pr-2 py-1.5 focus:ring-1 focus:ring-primary/30 outline-none"
                                />
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer mt-1 group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={!!item.hasInvoiceTriangulation}
                                        onChange={e => updateItem(item.id, 'hasInvoiceTriangulation', e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="h-3 w-3 border border-input rounded flex-shrink-0 bg-background peer-checked:bg-primary peer-checked:border-primary peer-focus:ring-1 transition-all flex items-center justify-center">
                                        {item.hasInvoiceTriangulation && <svg width="8" height="8" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary-foreground"><path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L6.28284 12.8222C6.10444 13.0959 5.75163 13.2307 5.43825 13.1444C5.12487 13.058 4.90806 12.7846 4.86981 12.46L4.01529 5.33534C3.96203 4.89133 4.41727 4.56702 4.82512 4.69749L10.7428 6.58988C11.0772 6.69679 11.4582 6.5501 11.6214 6.24227L11.4669 3.72684Z" fill="currentColor" /></svg>}
                                    </div>
                                </div>
                                <span className="text-[9px] text-muted-foreground font-medium select-none group-hover:text-primary transition-colors">Triangulação de Nf</span>
                            </label>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">VALIDADE DA PROPOSTA</label>
                            <input
                                value={item.validity || ''}
                                onChange={e => updateItem(item.id, 'validity', e.target.value)}
                                placeholder="30 dias..."
                                className="w-full bg-background border border-border rounded text-xs px-2.5 py-1.5 focus:ring-1 focus:ring-primary/30 outline-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">Prazo de Entrega</label>
                            <div className="flex flex-col gap-1.5">
                                <input
                                    type="date"
                                    value={item.deliveryDate || ''}
                                    onChange={e => updateItem(item.id, 'deliveryDate', e.target.value)}
                                    className="w-full bg-background border border-border rounded text-[11px] px-2 py-1.5 focus:ring-1 focus:ring-primary/30 outline-none"
                                />
                                <input
                                    value={item.deliveryTime || ''}
                                    onChange={e => updateItem(item.id, 'deliveryTime', e.target.value)}
                                    placeholder="Ex: 5 dias úteis..."
                                    className="w-full bg-background border border-border rounded text-[11px] px-2 py-1 focus:ring-1 focus:ring-primary/30 outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">Garantia</label>
                            <input
                                value={item.warrantyDays || ''}
                                onChange={e => updateItem(item.id, 'warrantyDays', e.target.value)}
                                placeholder="Nenhuma / 1 Ano"
                                className="w-full bg-background border border-border rounded text-xs px-2.5 py-1.5 focus:ring-1 focus:ring-primary/30 outline-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">VENDE FATURADO?</label>
                            <div className="flex flex-col gap-1.5">
                                <div className="flex border border-border rounded overflow-hidden select-none bg-background">
                                    <span onClick={() => updateItem(item.id, 'invoicedSales', false)} className={`flex-1 text-center py-1 text-[11px] cursor-pointer font-medium ${item.invoicedSales !== true ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}>Não</span>
                                    <span onClick={() => updateItem(item.id, 'invoicedSales', true)} className={`flex-1 text-center py-1 text-[11px] cursor-pointer font-medium border-l border-border ${item.invoicedSales === true ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary/50'}`}>Sim</span>
                                </div>
                                {item.invoicedSales && (
                                    <input
                                        value={item.invoiceTerm || ''}
                                        onChange={e => updateItem(item.id, 'invoiceTerm', e.target.value)}
                                        placeholder="Prazos: 15/30/45..."
                                        className="w-full animate-in fade-in bg-background border border-primary/30 rounded text-[11px] px-2 py-1 focus:ring-1 focus:ring-primary outline-none"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">Forma de Pagamento</label>
                            <select
                                value={item.paymentTerms || ''}
                                onChange={e => handleFieldChangeImpactingTotal('paymentTerms', e.target.value)}
                                className="w-full bg-background border border-border text-foreground rounded text-xs px-2 py-1.5 focus:ring-1 focus:ring-primary/30 outline-none"
                            >
                                <option value="">Não informado</option>
                                <option value="À vista">Dinheiro (À vista)</option>
                                <option value="PIX">PIX</option>
                                <option value="Boleto">Boleto Bancário</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Cartão de Débito">Cartão de Débito</option>
                                <option value="Transferência Bancária">Transferência (TED/DOC)</option>
                            </select>
                        </div>

                        {/* Desconto Híbrido Conditional */}
                        <div className="space-y-1.5 p-1.5 border border-dashed border-border/60 rounded">
                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={!!item.hasCashDiscount}
                                        onChange={e => handleFieldChangeImpactingTotal('hasCashDiscount', e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="h-3.5 w-3.5 border border-input rounded flex-shrink-0 bg-background peer-checked:bg-green-500/80 peer-checked:border-green-500 peer-focus:ring-2 transition-all flex items-center justify-center">
                                        {item.hasCashDiscount && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                                    </div>
                                </div>
                                <span className="text-[10px] uppercase font-bold text-muted-foreground select-none">Aplicar Desconto?</span>
                            </label>

                            {item.hasCashDiscount && (
                                <div className="animate-in fade-in slide-in-from-top-1 relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        max="100"
                                        value={item.cashDiscount || ''}
                                        onChange={e => handleFieldChangeImpactingTotal('cashDiscount', Number(e.target.value))}
                                        placeholder="Porcentagem (Ex: 5, 12, 18.5)..."
                                        className="w-full bg-green-500/10 border-green-500/30 text-green-600 border rounded text-xs pl-6 pr-2 py-1 focus:ring-1 focus:ring-green-500/50 outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Juros Condicionais Baseado na Forma de Pagamento */}
                        {['Cartão de Crédito', 'Boleto'].includes(item.paymentTerms || '') ? (
                            <div className="space-y-1.5 lg:col-span-2 p-1.5 bg-orange-500/5 border border-orange-500/20 rounded">
                                <label className="text-[9px] uppercase tracking-widest font-bold text-orange-600/70 flex items-center gap-1">
                                    <Calculator className="h-3 w-3" /> Condição de Parcelamento
                                </label>
                                <div className="flex gap-2 animate-in fade-in">
                                    <div className="flex-1 relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground ml-1">Parcelas</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.installmentsCount || ''}
                                            onChange={e => handleFieldChangeImpactingTotal('installmentsCount', Number(e.target.value))}
                                            placeholder="Ex: 5"
                                            className="w-full bg-background border border-border rounded text-xs pl-14 pr-1 py-1 focus:ring-1 focus:ring-orange-500/30 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Empty placeholder div to keep grid balance if no installments allowed
                            <div className="hidden lg:block lg:col-span-2"></div>
                        )}

                        <div className="space-y-1.5 lg:col-span-2">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">Checkbox Adicionais</label>
                            <div className="flex gap-4 items-center bg-background border border-border rounded px-3 py-1.5">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={!!item.hasInsurance}
                                            onChange={e => updateItem(item.id, 'hasInsurance', e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-4 w-4 border border-input rounded-sm bg-transparent peer-checked:bg-primary peer-checked:border-primary peer-focus:ring-2 disabled:cursor-not-allowed transition-all flex items-center justify-center">
                                            {item.hasInsurance && <svg width="10" height="10" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary-foreground"><path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L6.28284 12.8222C6.10444 13.0959 5.75163 13.2307 5.43825 13.1444C5.12487 13.058 4.90806 12.7846 4.86981 12.46L4.01529 5.33534C3.96203 4.89133 4.41727 4.56702 4.82512 4.69749L10.7428 6.58988C11.0772 6.69679 11.4582 6.5501 11.6214 6.24227L11.4669 3.72684Z" fill="currentColor" /></svg>}
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-medium select-none">Seguro de Carga</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={!!item.hasServiceContract}
                                            onChange={e => updateItem(item.id, 'hasServiceContract', e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-4 w-4 border border-input rounded-sm bg-transparent peer-checked:bg-primary peer-checked:border-primary peer-focus:ring-2 disabled:cursor-not-allowed transition-all flex items-center justify-center">
                                            {item.hasServiceContract && <svg width="10" height="10" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary-foreground"><path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L6.28284 12.8222C6.10444 13.0959 5.75163 13.2307 5.43825 13.1444C5.12487 13.058 4.90806 12.7846 4.86981 12.46L4.01529 5.33534C3.96203 4.89133 4.41727 4.56702 4.82512 4.69749L10.7428 6.58988C11.0772 6.69679 11.4582 6.5501 11.6214 6.24227L11.4669 3.72684Z" fill="currentColor" /></svg>}
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-medium select-none">Fornece Contrato Serviço</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* SubItems Array */}
                    <div className="bg-background/50 rounded border border-border/50 p-3 mt-2">
                        <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                            <h5 className="text-xs font-bold text-muted-foreground">Itens da Cotação</h5>
                            <button
                                onClick={addSubItem}
                                className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-2 py-1 rounded transition-colors"
                            >
                                <Plus className="h-3 w-3" /> ADICIONAR ITEM
                            </button>
                        </div>

                        {(item.items?.length === 0 || !item.items) ? (
                            <div className="text-center py-4 text-xs text-muted-foreground italic">
                                Nenhum produto ou serviço listado neste fornecedor.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                                    <div className="col-span-1 border-r border-border/50 text-center">#</div>
                                    <div className="col-span-5">Descrição</div>
                                    <div className="col-span-2 text-right">Qtd</div>
                                    <div className="col-span-2 text-right">V. Unit</div>
                                    <div className="col-span-2 text-right pr-6">Total</div>
                                </div>
                                {item.items.map((sub: any, subIdx: number) => (
                                    <div key={sub.id} className="grid grid-cols-12 gap-2 items-center bg-secondary/50 p-2 rounded-lg border border-border group/sub">
                                        <div className="col-span-1 text-[10px] text-muted-foreground text-center font-medium border-r border-border/50">
                                            {String(subIdx + 1).padStart(2, '0')}
                                        </div>
                                        <div className="col-span-5 relative">
                                            <input
                                                value={sub.description}
                                                onChange={e => updateSubItem(sub.id, 'description', e.target.value)}
                                                placeholder="Nome do produto ou serviço..."
                                                className="w-full bg-transparent border-none text-xs px-1 py-1 focus:ring-1 focus:ring-primary/20 rounded outline-none"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                min="1"
                                                value={sub.quantity || ''}
                                                onChange={e => updateSubItem(sub.id, 'quantity', Number(e.target.value))}
                                                className="w-full bg-background border border-border/50 rounded text-xs px-2 py-1 focus:ring-1 focus:ring-primary/20 outline-none text-right font-mono"
                                            />
                                        </div>
                                        <div className="col-span-2 relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={sub.unitPrice || ''}
                                                onChange={e => updateSubItem(sub.id, 'unitPrice', Number(e.target.value))}
                                                className="w-full bg-background border border-border/50 rounded text-xs pl-6 pr-2 py-1 focus:ring-1 focus:ring-primary/20 outline-none text-right font-mono"
                                            />
                                        </div>
                                        <div className="col-span-2 text-right text-xs font-mono font-bold text-primary flex justify-between items-center pl-1">
                                            <span className="truncate">{formatCurrency(sub.totalPrice || 0)}</span>
                                            <button
                                                onClick={() => removeSubItem(sub.id)}
                                                className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover/sub:opacity-100"
                                                title="Remover Item"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notes Field */}
                    <div className="space-y-2 mt-2">
                        <label className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5 text-muted-foreground">
                            Observações Específicas
                        </label>
                        <textarea
                            value={item.notes || ''}
                            onChange={e => updateItem(item.id, 'notes', e.target.value)}
                            placeholder="Condições de frete, impostos aplicáveis ou isenções..."
                            rows={1}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-y custom-scrollbar min-h-[40px]"
                        />
                    </div>

                    {/* Danger Zone Actions */}
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-border/50">
                        <button
                            onClick={() => cloneItem(item.id)}
                            className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded"
                            title="Duplicar cotação idêntica de forma autônoma"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> CLONAR COTAÇÃO
                        </button>
                        <button
                            onClick={() => removeItem(item.id)}
                            className="text-[10px] font-bold text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded"
                            title="Excluir Cotação Inteira Permanente"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> EXCLUIR COTAÇÃO
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const BudgetModal = ({ budget, onClose }: BudgetModalProps) => {
    const { addBudget, updateBudget, companies } = useKanbanStore();

    const [formData, setFormData] = useState<Partial<Budget>>(budget || {
        title: '',
        type: 'Produto',
        status: 'Aguardando',
        cardId: '',
        items: [],
        totalValue: 0
    });

    const { cards, lists, boards } = useKanbanStore();

    const allowedCards = cards.filter(c => {
        if (c.archived || c.trashed) return false;
        const list = lists.find(l => l.id === c.listId);
        if (!list) return true;
        const board = boards.find(b => b.id === list.boardId);
        if (!board) return true;
        const boardName = board.name.toLowerCase();

        // Ignorar cartões que estão dentro de boards feitos exclusivamente para cadastro antigo de empresas
        if (boardName.includes('fornecedor') || boardName.includes('transportadora') || boardName.includes('empresas')) {
            return false;
        }
        return true;
    });

    // Auto-Initialization / Creation for New Budgets
    const [activeBudgetId, setActiveBudgetId] = useState<string | undefined>(budget?.id);

    useEffect(() => {
        if (!budget?.id && !activeBudgetId) {
            // It's a "New Budget", pre-create it silently
            const newId = crypto.randomUUID();
            const initialData: Omit<Budget, 'id' | 'createdAt'> = {
                title: formData.title || 'Novo Orçamento',
                type: formData.type as BudgetType || 'Produto',
                status: formData.status as BudgetStatus || 'Aguardando',
                cardId: formData.cardId || '',
                items: formData.items || [],
                totalValue: formData.totalValue || 0,
            };
            addBudget({ ...initialData, id: newId } as unknown as Omit<Budget, 'id' | 'createdAt'>);
            setActiveBudgetId(newId);
        }
    }, [budget, activeBudgetId, addBudget, formData]);


    // Auto-Save Effect (Debounce)
    useEffect(() => {
        if (!activeBudgetId) return;

        const timeoutId = setTimeout(() => {
            if (activeBudgetId) {
                // Ensure we only update if not completely empty or deleted
                updateBudget(activeBudgetId, formData);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [formData, activeBudgetId, updateBudget]);


    // Combobox states
    const [cardSearch, setCardSearch] = useState('');
    const [isCardDropdownOpen, setIsCardDropdownOpen] = useState(false);

    const filteredCards = allowedCards.filter(c => c.title.toLowerCase().includes(cardSearch.toLowerCase()) ||
        lists.find(l => l.id === c.listId)?.title.toLowerCase().includes(cardSearch.toLowerCase()));

    // Refs for clicking outside
    const cardDropdownRef = useRef<HTMLDivElement>(null);
    const supplierDropdownRef = useRef<HTMLDivElement>(null);
    const transporterDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (cardDropdownRef.current && !cardDropdownRef.current.contains(event.target as Node)) {
                setIsCardDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const calculateTotal = (items: any[]) => {
        return items.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
    };

    const addItem = () => {
        const newGroup = {
            id: crypto.randomUUID(),
            companyId: undefined,
            transporterId: undefined,
            validity: '',
            notes: '',
            items: [],
            totalPrice: 0
        };
        const newItems = [...(formData.items || []), newGroup];
        setFormData(prev => ({
            ...prev,
            items: newItems,
            totalValue: calculateTotal(newItems)
        }));
    };

    const updateItem = (id: string, field: string, value: any) => {
        setFormData(prev => {
            const newItems = (prev.items || []).map(group => {
                if (group.id === id) {
                    const updated = { ...group, [field]: value };
                    if (field === 'items') {
                        updated.totalPrice = (value as any[]).reduce((sum, sub) => sum + (sub.totalPrice || 0), 0);
                    }
                    return updated;
                }
                return group;
            });

            return {
                ...prev,
                items: newItems,
                totalValue: calculateTotal(newItems)
            };
        });
    };

    const removeItem = (id: string) => {
        setFormData(prev => {
            const newItems = (prev.items || []).filter(item => item.id !== id);
            return {
                ...prev,
                items: newItems,
                totalValue: calculateTotal(newItems)
            };
        });
    };

    const cloneItem = (id: string) => {
        setFormData(prev => {
            const items = prev.items || [];
            const itemToClone = items.find(item => item.id === id);

            if (!itemToClone) return prev;

            // Deep clone to ensure all inner items and inputs get fresh IDs and pure copies
            const clonedItem = {
                ...itemToClone,
                id: crypto.randomUUID(),
                items: (itemToClone.items || []).map(subItem => ({
                    ...subItem,
                    id: crypto.randomUUID()
                }))
            };

            const newItems = [...items, clonedItem];

            return {
                ...prev,
                items: newItems,
                // The total value of the general budget doesn't change by just having a copy of a quote. 
                // Only the "cheapest" quote counts for the outer view, so saving the cloned card is enough.
                totalValue: calculateTotal(newItems)
            };
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-background w-full max-w-7xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] border border-border overflow-hidden">

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
                    <div className="flex flex-col gap-6">

                        {/* Top Area (Main Info) */}
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-border pb-2">
                                    <FileText className="h-4 w-4 text-primary" /> Informações Básicas
                                </h3>

                                <div className="space-y-2 relative" ref={cardDropdownRef}>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cartão Referente (opcional)</label>
                                    <button
                                        onClick={() => setIsCardDropdownOpen(!isCardDropdownOpen)}
                                        className="w-full bg-secondary border border-border/50 rounded-lg px-4 py-2 text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    >
                                        <span className="truncate">
                                            {formData.cardId
                                                ? cards.find(c => c.id === formData.cardId)?.title
                                                : "Nenhum (Avulso)"}
                                        </span>
                                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                    </button>

                                    {isCardDropdownOpen && (
                                        <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                                            <div className="p-2 border-b border-border flex items-center gap-2">
                                                <Search className="h-4 w-4 text-muted-foreground opacity-50 shrink-0" />
                                                <input
                                                    autoFocus
                                                    value={cardSearch}
                                                    onChange={e => setCardSearch(e.target.value)}
                                                    placeholder="Buscar cartões..."
                                                    autoComplete="off"
                                                    spellCheck="false"
                                                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                                />
                                            </div>
                                            <div className="max-h-56 overflow-y-auto custom-scrollbar p-1">
                                                <button
                                                    onClick={() => {
                                                        setFormData({ ...formData, cardId: undefined });
                                                        setIsCardDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary ${!formData.cardId ? 'bg-primary/10 text-primary font-medium' : ''}`}
                                                >
                                                    Nenhum (Avulso)
                                                </button>
                                                {filteredCards.length === 0 ? (
                                                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum cartão encontrado.</p>
                                                ) : (
                                                    filteredCards.map(c => {
                                                        const list = lists.find(l => l.id === c.listId);
                                                        const board = list ? boards.find(b => b.id === list.boardId) : null;
                                                        return (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => {
                                                                    setFormData({ ...formData, cardId: c.id, title: c.title });
                                                                    setIsCardDropdownOpen(false);
                                                                }}
                                                                className={`w-full text-left flex flex-col px-3 py-2 rounded-md transition-colors hover:bg-secondary ${formData.cardId === c.id ? 'bg-primary/10 text-primary font-medium' : 'text-sm'}`}
                                                            >
                                                                <span>{c.title}</span>
                                                                {board && <span className="text-[10px] text-muted-foreground mt-0.5">{board.name} {' > '} {list?.title}</span>}
                                                            </button>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
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
                                <div className="flex items-center justify-between border-b border-border pb-2 mt-6">
                                    <h3 className="text-sm font-semibold flex items-center gap-2">
                                        <Calculator className="h-4 w-4 text-primary" /> Cotações
                                    </h3>
                                    <button onClick={addItem} className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1">
                                        <Plus className="h-3.5 w-3.5" /> Adicionar cotação
                                    </button>
                                </div>

                                {formData.items?.length === 0 ? (
                                    <div className="text-center py-8 bg-secondary/50 rounded-lg border border-dashed border-border">
                                        <Calculator className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                        <p className="text-sm text-muted-foreground">Nenhuma cotação adicionada a este orçamento.</p>
                                        <button onClick={addItem} className="mt-3 text-xs font-medium text-primary hover:underline">
                                            Adicionar a primeira cotação
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {[...(formData.items || [])].sort((a, b) => {
                                            if (a.isFavorite && !b.isFavorite) return -1;
                                            if (!a.isFavorite && b.isFavorite) return 1;
                                            return (a.totalPrice || 0) - (b.totalPrice || 0);
                                        }).map((item, idx) => (
                                            <QuotationItemCard
                                                key={item.id}
                                                item={item}
                                                idx={idx}
                                                updateItem={updateItem}
                                                removeItem={removeItem}
                                                cloneItem={cloneItem}
                                                formatCurrency={formatCurrency}
                                                companies={companies}
                                            />
                                        ))}

                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer (Removido - Será trocado pelo Auto-Save) */}
                <div className="flex justify-end p-6 border-t border-border mt-2 bg-secondary/10">
                    {/* Actions will be replaced or omitted depending on the exact UX need - For now just spacing */}
                </div>
            </div>
        </div>
    );
};

export default BudgetModal;
