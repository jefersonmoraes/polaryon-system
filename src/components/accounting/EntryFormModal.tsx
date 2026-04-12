import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAccountingStore } from '@/store/accounting-store';
import { EntryType, AccountingCategory } from '@/types/accounting';
import { useKanbanStore } from '@/store/kanban-store';
import { toast } from 'sonner';
import { useRef } from 'react';
import { Paperclip, Search, Download, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import { cn, compressImage } from '@/lib/utils';
import { FilePreviewModal } from '../ui/FilePreviewModal';
import { motion, AnimatePresence } from 'framer-motion';

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

    const [formData, setFormData] = useState<{
        title: string;
        description: string;
        amount: string;
        categoryId: string;
        date: string;
        status: 'pending' | 'paid' | 'overdue';
        documentNumber: string;
        documentEntity: string;
        documentEntityId: string;
        competenceDate: string;
        paymentMethod: any;
        bankAccountId: string;
        notes: string;
        attachments?: string[];
    }>({
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
        notes: '',
        attachments: []
    });

    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceFrequency, setRecurrenceFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
    const [recurrenceCount, setRecurrenceCount] = useState(2);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Drag and Drop State
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Preview State
    const [previewData, setPreviewData] = useState<{ isOpen: boolean; url: string; name: string; type?: string }>({
        isOpen: false,
        url: '',
        name: '',
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
                        documentNumber: entry.documentNumber || '',
                        documentEntity: entry.documentEntity || '',
                        documentEntityId: entry.documentEntityId || '',
                        competenceDate: entry.competenceDate ? new Date(entry.competenceDate).toISOString().split('T')[0] : new Date(entry.date).toISOString().split('T')[0],
                        paymentMethod: entry.paymentMethod || 'bank_transfer',
                        bankAccountId: entry.bankAccountId || '',
                        notes: entry.notes || '',
                        attachments: entry.attachments || []
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
                    notes: '',
                    attachments: [] as string[]
                });
                setIsRecurring(false);
                setRecurrenceFrequency('monthly');
                setRecurrenceCount(2);
                setErrors({});
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

    const processFiles = async (files: File[]) => {
        if (!files.length) return;
        
        const toastId = toast.loading(`Processando ${files.length} arquivo(s)...`);
        
        try {
            const newAttachments: string[] = [];
            
            for (const file of files) {
                let fileUrl: string;

                if (file.type.startsWith('image/') && !file.type.includes('svg')) {
                    try {
                        fileUrl = await compressImage(file);
                    } catch (err) {
                        console.error("Compression failed", err);
                        fileUrl = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.readAsDataURL(file);
                        });
                    }
                } else {
                    fileUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    });
                }
                newAttachments.push(fileUrl);
            }

            setFormData(prev => ({
                ...prev,
                attachments: [...(prev.attachments || []), ...newAttachments]
            }));
            toast.success(`${files.length} arquivo(s) prontos.`, { id: toastId });
        } catch (error) {
            toast.error("Erro ao processar arquivos.", { id: toastId });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        processFiles(files);
        e.target.value = '';
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            processFiles(files);
        }
    };

    const removeAttachment = (indexToRemove: number) => {
        setFormData((prev) => ({
            ...prev,
            attachments: prev.attachments?.filter((_, index) => index !== indexToRemove) || [],
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCompany) {
            toast.error('Nenhuma empresa ativa selecionada');
            return;
        }

        const newErrors: Record<string, string> = {};
        if (!formData.title) newErrors.title = 'Título é obrigatório';
        if (!formData.amount) newErrors.amount = 'Valor é obrigatório';
        if (!formData.categoryId) newErrors.categoryId = 'Categoria é obrigatória';

        // Convert BRL format to number (e.g. 1.234,56 -> 1234.56)
        const cleanAmount = formData.amount.replace(/\./g, '').replace(',', '.');
        const numericAmount = parseFloat(cleanAmount);

        if (isNaN(numericAmount) || numericAmount <= 0) {
            newErrors.amount = 'Valor inválido ou menor que zero';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error('Corrija os erros no formulário');
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
            notes: formData.notes,
            attachments: formData.attachments
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
            notes: '',
            attachments: [] as string[]
        });

        onOpenChange(false);
        if (onSuccess) onSuccess();
    };

    const isRevenue = type === 'revenue';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent 
                className="sm:max-w-[550px] bg-background border border-border text-foreground max-h-[90vh] overflow-y-auto custom-scrollbar"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Drag & Drop Overlay */}
                <AnimatePresence>
                    {isDragging && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[100] bg-primary/10 backdrop-blur-[2px] border-4 border-dashed border-primary flex flex-col items-center justify-center p-6 pointer-events-none"
                        >
                            <div className="bg-background/90 p-8 rounded-full shadow-2xl border-2 border-primary animate-pulse">
                                <Paperclip className="h-16 w-16 text-primary" />
                            </div>
                            <h3 className="mt-6 text-2xl font-black text-primary uppercase tracking-tighter">Solte para anexar comprovantes</h3>
                            <p className="text-sm font-bold text-muted-foreground mt-2">Imagens serão otimizadas automaticamente</p>
                        </motion.div>
                    )}
                </AnimatePresence>
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
                                onChange={(e) => {
                                    setFormData(p => ({ ...p, title: e.target.value }));
                                    if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
                                }}
                                placeholder={isRevenue ? "Ex: Venda Produto X" : "Ex: Conta de Luz"}
                                className={`w-full bg-secondary/50 border rounded px-3 py-2 text-sm outline-none transition-colors ${errors.title ? 'border-destructive focus:border-destructive animate-shake' : 'border-border focus:border-primary'}`}
                            />
                            {errors.title && <span className="text-[10px] text-destructive font-bold uppercase">{errors.title}</span>}
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
                                        if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }));
                                    }}
                                    placeholder="0,00"
                                    className={`w-full bg-secondary/50 border rounded px-3 py-2 text-sm outline-none transition-colors font-mono ${errors.amount ? 'border-destructive focus:border-destructive animate-shake' : 'border-border focus:border-primary'}`}
                                />
                                {errors.amount && <span className="text-[10px] text-destructive font-bold uppercase">{errors.amount}</span>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">Categoria Contábil*</label>
                                <select
                                    required
                                    value={formData.categoryId}
                                    onChange={(e) => {
                                        setFormData(p => ({ ...p, categoryId: e.target.value }));
                                        if (errors.categoryId) setErrors(prev => ({ ...prev, categoryId: '' }));
                                    }}
                                    className={`w-full bg-background text-foreground border rounded px-3 py-2 text-sm outline-none transition-colors cursor-pointer ${errors.categoryId ? 'border-destructive focus:border-destructive animate-shake shadow-[0_0_0_1px_rgba(239,68,68,0.5)]' : 'border-border focus:border-primary'}`}
                                >
                                    <option className="bg-background text-foreground" value="" disabled>Selecione uma categoria...</option>
                                    {typeCategories.map(cat => (
                                        <option className="bg-background text-foreground" key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                {errors.categoryId && <span className="text-[10px] text-destructive font-bold uppercase">{errors.categoryId}</span>}
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
                                <optgroup label="Bancos Principais Brasileiros">
                                    <option className="bg-background text-foreground" value="itau">Itaú Unibanco</option>
                                    <option className="bg-background text-foreground" value="bb">Banco do Brasil</option>
                                    <option className="bg-background text-foreground" value="bradesco">Bradesco</option>
                                    <option className="bg-background text-foreground" value="caixa">Caixa Econômica Federal</option>
                                    <option className="bg-background text-foreground" value="santander">Santander</option>
                                    <option className="bg-background text-foreground" value="nubank">Nubank</option>
                                    <option className="bg-background text-foreground" value="inter">Banco Inter</option>
                                    <option className="bg-background text-foreground" value="c6">C6 Bank</option>
                                    <option className="bg-background text-foreground" value="sicoob">Sicoob</option>
                                    <option className="bg-background text-foreground" value="sicredi">Sicredi</option>
                                    <option className="bg-background text-foreground" value="btg">BTG Pactual</option>
                                    <option className="bg-background text-foreground" value="cora">Cora</option>
                                </optgroup>
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

                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Comprovantes e Anexos (PDF / Imagem)</label>

                            <div className="flex flex-col gap-2">
                                <label className="flex items-center justify-center gap-2 cursor-pointer w-full border border-dashed border-border/50 rounded hover:bg-secondary/30 transition-colors p-3 py-4 bg-background group">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        multiple
                                        accept="image/png, image/jpeg, application/pdf"
                                        onChange={handleFileChange}
                                    />
                                    <Paperclip className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    <span className="text-xs text-muted-foreground font-medium group-hover:text-primary transition-colors">Clique para arrastar ou adicionar comprovante</span>
                                </label>

                                {formData.attachments && formData.attachments.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                        {formData.attachments.map((file, index) => {
                                            const isImage = file.startsWith('data:image');
                                            const fileType = isImage ? 'image' : file.startsWith('data:application/pdf') ? 'pdf' : undefined;
                                            
                                            return (
                                                <div key={index} className="relative group rounded border border-border bg-secondary overflow-hidden h-20 flex flex-col items-center justify-center">
                                                    {isImage ? (
                                                        <img src={file} className="object-cover w-full h-full opacity-80 group-hover:opacity-40 transition-opacity" alt="Anexo" />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className="text-xs font-bold text-muted-foreground uppercase">{fileType === 'pdf' ? 'PDF' : 'DOC'}</div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Toolbar de Ações */}
                                                    <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewData({ isOpen: true, url: file, name: `Comprovante-${index + 1}`, type: fileType })}
                                                            className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                                                            title="Visualizar"
                                                        >
                                                            <Search className="h-3.5 w-3.5" />
                                                        </button>
                                                        <a 
                                                            href={file} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                                                            title="Abrir em Nova Aba"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeAttachment(index)}
                                                            className="w-8 h-8 bg-destructive text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                                                            title="Remover"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
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
            <FilePreviewModal
                isOpen={previewData.isOpen}
                onClose={() => setPreviewData(prev => ({ ...prev, isOpen: false }))}
                fileUrl={previewData.url}
                fileName={previewData.name}
                fileType={previewData.type}
            />
        </Dialog>
    );
};

export default EntryFormModal;
