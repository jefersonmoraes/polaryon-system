import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { FileText, Plus, Receipt, X, Download, ExternalLink, Copy, Check, Info, Upload, Edit, Trash2, Search, RotateCcw, Filter } from 'lucide-react';
import { InvoiceType, InvoiceStatus } from '@/types/accounting';
import { toast } from 'sonner';
import { useRef } from 'react';
import { cn, compressImage } from '@/lib/utils';
import { FilePreviewModal } from '../ui/FilePreviewModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export const InvoiceManager = () => {
    const { invoices, addInvoice, updateInvoice, deleteInvoice, addEntry } = useAccountingStore();
    const { mainCompanies, budgets, cards } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];


    const [isFormOpen, setIsFormOpen] = useState(false);
    const [invoiceType, setInvoiceType] = useState<InvoiceType>('service');
    const [invoiceToEdit, setInvoiceToEdit] = useState<any>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<InvoiceStatus | 'all'>('all');

    // States for the MEI draft sync (General & Service)
    const [draftClientName, setDraftClientName] = useState('');
    const [draftClientDocument, setDraftClientDocument] = useState('');
    const [draftCep, setDraftCep] = useState('');
    const [draftDescription, setDraftDescription] = useState('');
    const [draftAmount, setDraftAmount] = useState('');

    // States specific to NF-e (Produto)
    const [draftNcm, setDraftNcm] = useState('');
    const [draftCfop, setDraftCfop] = useState('');
    const [draftUnit, setDraftUnit] = useState('UN');
    const [draftQuantity, setDraftQuantity] = useState('1');
    const [draftUnitPrice, setDraftUnitPrice] = useState('');
    const [isInterstate, setIsInterstate] = useState(false);

    // Manage local copy states for icon feedback
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Drag and Drop State
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    // Preview State
    const [previewData, setPreviewData] = useState<{ isOpen: boolean; url: string; name: string; type?: string }>({
        isOpen: false,
        url: '',
        name: '',
    });

    const isMEI = activeCompany?.porte === 'MEI';
    const isMEIService = isMEI && invoiceType === 'service';
    const isMEIProduct = isMEI && invoiceType === 'product';
    const isMEIDraftView = true; // Enabled for all company types
    const isProduct = invoiceType === 'product';
    const isService = invoiceType === 'service';

    const companyInvoices = invoices.filter(i => i.companyId === activeCompany?.id);

    // Derived state
    const filteredInvoices = companyInvoices.filter(inv => {
        // Only show invoices that are not in the global trash
        if (inv.trashedAt && filterStatus !== 'cancelled') return false;

        const matchesSearch = inv.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (inv.clientDocument && inv.clientDocument.replace(/\D/g, '').includes(searchQuery.replace(/\D/g, '')));

        const matchesStatus = filterStatus === 'all'
            ? true
            : filterStatus === 'cancelled'
                ? inv.trashedAt !== undefined // Map 'cancelled' local filter to 'trashed' items
                : inv.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    // Auto-calculate total for Product draft ONLY IF user is typing in quantity or unit price manually
    // We will use a separate mechanism or just recalculate only if they haven't manually modified the draft amount.
    const [isManualAmount, setIsManualAmount] = useState(false);

    useEffect(() => {
        if (isProduct && !isManualAmount && draftQuantity && draftUnitPrice) {
            const rawQtd = parseFloat(draftQuantity.replace(',', '.')) || 0;
            const rawPrice = parseFloat(draftUnitPrice.replace(/\./g, '').replace(',', '.')) || 0;
            const total = (rawQtd * rawPrice).toFixed(2);
            if (rawQtd > 0 && rawPrice > 0) {
                setDraftAmount(total.replace('.', ','));
            }
        }
    }, [draftQuantity, draftUnitPrice, isProduct, isManualAmount]);

    const handleCopy = (text: string, field: string) => {
        if (!text) {
            toast.info('Campo vazio, nada para copiar.');
            return;
        }
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        toast.success('Copiado para área de transferência!');
        setTimeout(() => setCopiedField(null), 2000);
    };

    const processFiles = async (files: File[]) => {
        if (!files.length) return;

        const file = files[0]; // Process only one for now (XML import)
        
        if (file.name.toLowerCase().endsWith('.xml')) {
            const toastId = toast.loading("Processando XML...");
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const xmlText = event.target?.result as string;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
                    const parseError = xmlDoc.getElementsByTagName("parsererror");
                    if (parseError.length > 0) {
                        toast.error("Erro ao ler o arquivo XML. Formato inválido.", { id: toastId });
                        return;
                    }
                    const prod = xmlDoc.getElementsByTagName('prod')[0];
                    if (!prod) {
                        toast.error("Nenhum produto (tag <prod>) encontrado no XML.", { id: toastId });
                        return;
                    }
                    const xProd = prod.getElementsByTagName('xProd')[0]?.textContent || '';
                    const ncm = prod.getElementsByTagName('NCM')[0]?.textContent || '';
                    const uCom = prod.getElementsByTagName('uCom')[0]?.textContent || '';
                    const qCom = prod.getElementsByTagName('qCom')[0]?.textContent || '1';
                    setDraftDescription(xProd);
                    setDraftNcm(ncm);
                    setDraftUnit(uCom.toUpperCase());
                    const parsedQtd = parseFloat(qCom);
                    setDraftQuantity(isNaN(parsedQtd) ? '1' : parsedQtd.toString().replace('.', ','));
                    setDraftUnitPrice('');
                    setDraftCfop(isInterstate ? '6102' : '5102');
                    setIsFormOpen(true);
                    toast.success("Dados do produto importados via Drop!", { id: toastId });
                } catch (err) {
                    toast.error("Falha ao processar o XML.", { id: toastId });
                }
            };
            reader.readAsText(file);
        } else {
            toast.info("Apenas arquivos XML são aceitos para importação rápida.");
        }
    };

    const handleXmlImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFiles([file]);
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

    const handleIssueInvoice = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        let amount = 0;

        if (isMEIDraftView) {
            const rawDraftAmt = draftAmount.replace(/\./g, '').replace(',', '.');
            amount = parseFloat(rawDraftAmt);
        } else {
            const rawAmount = (formData.get('amount') as string || '').replace(/\./g, '').replace(',', '.');
            amount = parseFloat(rawAmount);
        }

        if (isNaN(amount) || amount <= 0) {
            toast.error("O valor da nota não pode ser zero.");
            return;
        }

        if (!activeCompany) {
            toast.error("Nenhuma empresa ativa.");
            return;
        }

        const inputNumber = formData.get('invoiceNumber') as string;
        const generatedNumber = inputNumber || `NF-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

        // Pick name and document depending on the flow
        const cName = isMEIDraftView ? draftClientName : (formData.get('clientName') as string);
        const cDoc = isMEIDraftView ? draftClientDocument : (formData.get('clientDocument') as string);

        if (invoiceToEdit) {
            updateInvoice(invoiceToEdit.id, {
                number: generatedNumber,
                clientName: cName,
                clientDocument: cDoc,
                amount: amount,
            });
            toast.success('Nota Fiscal atualizada com sucesso!');
        } else {
            const newInvoiceId = crypto.randomUUID();
            const newInvoice = {
                id: newInvoiceId,
                companyId: activeCompany.id,
                number: generatedNumber,
                issueDate: invoiceToEdit ? invoiceToEdit.issueDate : new Date().toISOString(),
                type: invoiceType,
                clientName: cName,
                clientDocument: cDoc,
                amount: amount,
                status: 'issued' as const,
            };

            addInvoice(newInvoice);

            // Ao registrar a NF, gera também uma receita provável no contas a receber com os dados validados
            addEntry({
                companyId: activeCompany.id,
                title: `Recebimento Ref. ${newInvoice.number} - ${newInvoice.clientName}`,
                amount: amount,
                date: new Date().toISOString(),
                type: 'revenue',
                categoryId: invoiceType === 'service' ? 'cat-rev-2' : 'cat-rev-1',
                status: 'pending',
                documentNumber: newInvoice.number,
                documentEntity: newInvoice.clientName,
                documentEntityId: newInvoice.clientDocument.replace(/\D/g, ''),
                competenceDate: newInvoice.issueDate,
                paymentMethod: 'bank_transfer',
                linkedInvoiceId: newInvoiceId
            });

            toast.success(`Nota Fiscal de ${invoiceType === 'service' ? 'Serviço' : 'Produto'} registrada com sucesso!`);
        }

        closeForm();
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setInvoiceToEdit(null);
        // Reset draft states
        setDraftClientName('');
        setDraftClientDocument('');
        setDraftCep('');
        setDraftDescription('');
        setDraftAmount('');
        setDraftNcm('');
        setDraftCfop('');
        setDraftUnit('UN');
        setDraftQuantity('1');
        setDraftUnitPrice('');
        setIsInterstate(false);
    };

    const handleAutoFillFromBudget = (budgetId: string) => {
        const budget = budgets.find(b => b.id === budgetId);
        if (!budget) return;

        // Sum the finalSellingPrice of all items if it exists, otherwise fallback to totalValue
        const finalAmount = budget.items.reduce((sum, item) => sum + (item.finalSellingPrice || item.totalPrice || 0), 0);

        setDraftAmount(finalAmount.toFixed(2).replace('.', ','));
        setIsManualAmount(true); // Flag to freeze auto-calculation from overwriting this budget value
        setDraftDescription(budget.title);

        if (budget.cardId) {
            const card = cards.find((c: any) => c.id === budget.cardId);
            if (card) {
                setDraftClientName(card.title);
            }
        }

        toast.success('Rascunho preenchido com dados do orçamento! Você pode editar os valores se precisar.');
    };

    const handleEditInvoice = (invoice: any) => {
        setInvoiceType(invoice.type);
        setInvoiceToEdit(invoice);
        // Setup draft values universally across all company types inside the editing flow
        setDraftClientName(invoice.clientName);
        setDraftClientDocument(invoice.clientDocument || '');
        setDraftAmount(invoice.amount.toFixed(2).replace('.', ','));
        setIsFormOpen(true);
    };

    const handleCancelInvoice = (invoice: any) => {
        if (confirm(`Tem certeza que deseja apagar a NF ${invoice.number}? Ela será enviada para a Lixeira Contábil.`)) {
            deleteInvoice(invoice.id);
            // Optionally, we could also cancel it, but trashedAt is enough for the global trash
            useAccountingStore.getState().updateInvoice(invoice.id, { status: 'cancelled' });

            // Tentar encontrar lançamento financeiro atrelado
            const storeState = useAccountingStore.getState();
            const relatedEntry = storeState.entries.find(e => e.linkedInvoiceId === invoice.id || (e.documentNumber === invoice.number && e.companyId === invoice.companyId));
            if (relatedEntry) {
                if (confirm("Você deseja também enviar o lançamento financeiro (Receita) atrelado a esta nota para a lixeira?")) {
                    storeState.deleteEntry(relatedEntry.id);
                }
            }
            toast.info(`Nota Fiscal ${invoice.number} enviada para a lixeira.`);
        }
    };

    const handleRecoverInvoice = (invoice: any) => {
        // Call the global restore method from the store
        // @ts-ignore
        useAccountingStore.getState().restoreInvoice(invoice.id);
        useAccountingStore.getState().updateInvoice(invoice.id, { status: 'issued' });
        toast.success(`Nota Fiscal ${invoice.number} restaurada com sucesso.`);
    };

    const handlePreviewInvoice = (invoice: any) => {
        // In local storage context, we might not have a real XML file, 
        // but we can generate one mock XML or just show the summary as a TXT
        const summary = `
=========================================
            NOTA FISCAL (${invoice.type === 'service' ? 'NFS-e' : 'NF-e'})
=========================================
Número: ${invoice.number}
Data de Emissão: ${new Date(invoice.issueDate).toLocaleDateString('pt-BR')}
Status: ${invoice.status.toUpperCase()}

Emissor:
Empresa: ${activeCompany?.razaoSocial || activeCompany?.nomeFantasia}
CNPJ: ${activeCompany?.cnpj}
Regime: ${activeCompany?.porte}

Destinatário:
Cliente: ${invoice.clientName}
Documento: ${invoice.clientDocument || 'Não informado'}

-----------------------------------------
VALOR TOTAL: R$ ${invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
-----------------------------------------
        `.trim();

        const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        setPreviewData({
            isOpen: true,
            url: url,
            name: `${invoice.number}.txt`,
            type: 'text'
        });
    };

    const handleDownloadInvoice = (invoice: any) => {
        const summary = `NF: ${invoice.number}\nCliente: ${invoice.clientName}\nValor: R$ ${invoice.amount.toFixed(2)}`;
        const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${invoice.number}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Download da nota ${invoice.number} concluído.`);
    };

    return (
        <div 
            className="kanban-card rounded-xl border border-border shadow-sm flex flex-col h-full relative overflow-hidden"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <AnimatePresence>
                {isDragging && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-[2px] border-4 border-dashed border-primary flex flex-col items-center justify-center p-6 pointer-events-none"
                    >
                        <div className="bg-background/90 p-8 rounded-full shadow-2xl border-2 border-primary animate-pulse">
                            <Upload className="h-16 w-16 text-primary" />
                        </div>
                        <h3 className="mt-6 text-2xl font-black text-primary uppercase tracking-tighter">Solte o XML para importar</h3>
                        <p className="text-sm font-bold text-muted-foreground mt-2">Dados do produto e cliente serão extraídos</p>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    Emissão de Notas Fiscais (ERP)
                </h3>
            </div>

            <div className="p-4 flex gap-3">
                <button
                    onClick={() => { setInvoiceType('service'); setIsFormOpen(true); }}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-lg flex flex-col items-center justify-center gap-2 transition-colors relative group overflow-hidden"
                >
                    <div className="absolute inset-0 bg-white/20 w-0 group-hover:w-full transition-all duration-300 ease-out"></div>
                    <Plus className="h-5 w-5 relative z-10" />
                    <span className="text-sm font-medium relative z-10">Registrar NFS-e (Serviço)</span>
                    <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded-full relative z-10">
                        {isMEI ? 'Padrão Nacional (Portal Gov)' : 'Prefeitura Municipal'}
                    </span>
                </button>
                <button
                    onClick={() => { setInvoiceType('product'); setIsFormOpen(true); }}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg flex flex-col items-center justify-center gap-2 transition-colors relative group overflow-hidden"
                >
                    <div className="absolute inset-0 bg-white/20 w-0 group-hover:w-full transition-all duration-300 ease-out"></div>
                    <Plus className="h-5 w-5 relative z-10" />
                    <span className="text-sm font-medium relative z-10">Registrar NF-e (Produto)</span>
                    <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded-full relative z-10">
                        Sefaz / Nacional
                    </span>
                </button>
            </div>

            <div className="p-4 flex-1 overflow-auto custom-scrollbar flex flex-col">
                <div className="flex flex-col gap-3 mb-4 shrink-0">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-muted-foreground">Controle de NFs Emitidas</h4>
                        <span className="text-[10px] text-muted-foreground font-bold bg-muted px-2 py-0.5 rounded-full">Total: {filteredInvoices.length}</span>
                    </div>

                    <div className="flex bg-muted/30 p-1.5 rounded-lg border border-border/50">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar por cliente ou número..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none text-sm px-9 py-1.5 focus:outline-none placeholder:text-muted-foreground text-foreground"
                            />
                        </div>
                        <div className="h-6 w-px bg-border mx-2 self-center"></div>
                        <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                            <SelectTrigger className="bg-background text-foreground border-none h-7 px-2 text-xs font-semibold focus:ring-1 focus:ring-primary w-[140px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                <SelectItem value="all" className="text-xs font-bold">Ver Ativas</SelectItem>
                                <SelectItem value="cancelled" className="text-xs font-bold">Lixeira (Canceladas)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {filteredInvoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-xl bg-muted/20 text-muted-foreground/60">
                        <FileText className="h-10 w-10 mb-2 opacity-50" />
                        <span className="text-sm font-medium">Nenhuma nota fisca foi registrada ainda.</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredInvoices.slice().reverse().map(invoice => (
                            <div key={invoice.id} className="group flex justify-between items-center bg-muted/20 p-3 rounded-xl border border-border hover:border-border/80 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg flex items-center justify-center ${invoice.type === 'service' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'} ${invoice.status === 'cancelled' ? 'opacity-50 grayscale' : ''}`}>
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className={`font-bold text-sm ${invoice.status === 'cancelled' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{invoice.number}</p>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/10 text-muted-foreground font-medium uppercase tracking-wider">
                                                {invoice.type === 'service' ? 'NFS-E' : 'NF-E'}
                                            </span>
                                            {invoice.status === 'cancelled' && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 font-bold uppercase tracking-wider">
                                                    Cancelada
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[150px]" title={invoice.clientName}>
                                            Cliente: {invoice.clientName}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <p className={`font-bold text-sm ${invoice.status === 'cancelled' ? 'text-muted-foreground' : 'text-foreground'}`}>R$ {invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>

                                    {/* Actions shown on hover generally, or always on mobile */}
                                    <div className="flex items-center justify-end gap-1.5 mt-1.5">
                                        <span className="text-[10px] text-muted-foreground/60 mr-1">{new Date(invoice.issueDate).toLocaleDateString('pt-BR')}</span>

                                        <button
                                            onClick={() => handlePreviewInvoice(invoice)}
                                            className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                                            title="Visualizar Nota"
                                        >
                                            <Search className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDownloadInvoice(invoice)}
                                            className="p-1.5 rounded-md bg-muted/50 hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                                            title="Baixar Resumo"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                        </button>

                                        {invoice.status === 'cancelled' || invoice.trashedAt ? (
                                            <button
                                                onClick={() => handleRecoverInvoice(invoice)}
                                                className="p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors"
                                                title="Restaurar Nota Fiscal da Lixeira"
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" />
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleEditInvoice(invoice)}
                                                    className="p-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    title="Editar Dados da Nota"
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleCancelInvoice(invoice)}
                                                    className="p-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    title="Cancelar/Excluir"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isFormOpen && document.body ? createPortal(
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className={`bg-background rounded-xl border border-border w-full ${isMEIDraftView ? 'max-w-5xl' : 'max-w-md'} max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 shrink-0">
                            <h3 className="font-bold flex items-center gap-2">
                                <Receipt className="h-5 w-5 text-primary" />
                                {invoiceToEdit ? 'Editar NF de ' : 'Registrar NF de '}
                                {invoiceType === 'service' ? 'Serviço (NFS-e)' : 'Produto (NF-e)'}
                            </h3>
                            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className={`flex-1 overflow-auto custom-scrollbar ${isMEIDraftView ? "flex flex-col md:flex-row" : ""}`}>
                            {/* Left Side (or Full Width): The Form */}
                            <form id="invoice-form" onSubmit={handleIssueInvoice} className={`p-5 space-y-4 ${isMEIDraftView ? 'w-full md:w-1/2 md:border-r md:border-border' : 'w-full'}`}>
                                <h4 className="font-bold">Dados do Faturamento</h4>

                                <div className="mb-2">
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Preencher a partir de Orçamento/Cotação Aprovada</label>
                                    <Select onValueChange={(v: string) => handleAutoFillFromBudget(v)}>
                                        <SelectTrigger className="w-full bg-background text-foreground border border-border rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary font-bold">
                                            <SelectValue placeholder="Selecione um orçamento..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            {budgets.filter(b => b.status === 'Aprovado' && b.type.toLowerCase() === (invoiceType === 'product' ? 'produto' : 'serviço')).length === 0 ? (
                                                <div className="p-2 text-xs text-muted-foreground text-center italic">Nenhum orçamento aprovado</div>
                                            ) : (
                                                budgets.filter(b => b.status === 'Aprovado' && b.type.toLowerCase() === (invoiceType === 'product' ? 'produto' : 'serviço')).map(b => {
                                                    const finalAmount = b.items.reduce((sum, item) => sum + (item.finalSellingPrice || item.totalPrice || 0), 0);
                                                    return (
                                                        <SelectItem key={b.id} value={b.id} className="text-xs font-bold">
                                                            {b.title} - R$ {finalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </SelectItem>
                                                    );
                                                })
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <p className="text-sm text-muted-foreground mb-4">
                                    {isMEIDraftView
                                        ? "Preencha abaixo para gerar o rascunho de cópia para o site."
                                        : "Preencha os dados da nota emitida externamente no portal governamental para fins de acompanhamento financeiro."}
                                </p>

                                {isMEIService ? (
                                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                        <p className="text-xs text-amber-600 font-medium mb-3">
                                            MEIs devem emitir a nota oficial diretamente pelo <strong>Portal Nacional (Gov.br)</strong>. Use o rascunho ao lado para copiar e colar no site, evitando erros!
                                        </p>
                                        <a
                                            href="https://www.nfse.gov.br/EmissorNacional"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center gap-2 w-full bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg py-2 transition-colors text-xs"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            Acessar Emissor Nacional (NFS-e)
                                        </a>
                                    </div>
                                ) : isMEIProduct ? (
                                    <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                        <p className="text-xs text-blue-600 font-medium mb-3">
                                            Para comércio, utilize o portal de NF-e da sua SEFAZ Estadual ou um emissor gratuito. Recomendamos o Emissor do Sebrae ou Sefaz SP.
                                        </p>
                                        <a
                                            href="https://www.sebrae.com.br/sites/PortalSebrae/produtos_servicos/emissor-nfe"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center gap-2 w-full bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg py-2 transition-colors text-xs"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            Emissor Sebrae / Sefaz
                                        </a>
                                    </div>
                                ) : (
                                    <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                        <p className="text-xs text-blue-600 font-medium mb-3">
                                            Empresas ME/EPP utilizam o sistema da Prefeitura ou SEFAZ. Emita a nota no portal oficial e use o rascunho ao lado para facilitar.
                                        </p>
                                        {invoiceType === 'service' ? (
                                            <div className="text-xs text-blue-600 font-semibold text-center py-2 border border-blue-500/20 rounded-lg bg-blue-500/5">
                                                Acesse o portal da prefeitura do seu município
                                            </div>
                                        ) : (
                                            <a
                                                href="https://www.nfe.fazenda.gov.br/portal/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center gap-2 w-full bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg py-2 transition-colors text-xs"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                Acessar Portal da NF-e (SEFAZ)
                                            </a>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Número da NF (Opcional)</label>
                                    <input
                                        type="text"
                                        name="invoiceNumber"
                                        placeholder="Ex: NF-1044"
                                        className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                                        defaultValue={invoiceToEdit?.number}
                                    />
                                    {isMEIDraftView && <span className="text-[10px] text-muted-foreground mt-1">Sempre preencha o número gerado no site após emitir.</span>}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do Cliente/Órgão</label>
                                    <input
                                        required
                                        name="clientName"
                                        type="text"
                                        className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                        placeholder="Prefeitura Municipal..."
                                        value={isMEIDraftView ? draftClientName : undefined}
                                        defaultValue={!isMEIDraftView && invoiceToEdit ? invoiceToEdit.clientName : undefined}
                                        onChange={isMEIDraftView ? (e) => setDraftClientName(e.target.value) : undefined}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">CNPJ/CPF do Consumidor/Tomador</label>
                                    <input
                                        required
                                        name="clientDocument"
                                        type="text"
                                        className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                        placeholder="00.000.000/0001-00"
                                        value={isMEIDraftView ? draftClientDocument : undefined}
                                        defaultValue={!isMEIDraftView && invoiceToEdit ? invoiceToEdit.clientDocument : undefined}
                                        onChange={isMEIDraftView ? (e) => setDraftClientDocument(e.target.value) : undefined}
                                    />
                                </div>

                                {isMEIDraftView && (
                                    <div>
                                        <label className="block text-xs font-medium text-muted-foreground mb-1">CEP do Destinatário</label>
                                        <input
                                            type="text"
                                            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                            placeholder="00000-000"
                                            value={draftCep}
                                            onChange={(e) => setDraftCep(e.target.value)}
                                        />
                                    </div>
                                )}

                                {isMEIService ? (
                                    <>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição do Serviço (Detalhado)</label>
                                            <textarea
                                                rows={3}
                                                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary custom-scrollbar resize-none"
                                                placeholder="Prestação de serviços de..."
                                                value={draftDescription}
                                                onChange={(e) => setDraftDescription(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Valor do Serviço (R$)</label>
                                            <input
                                                required
                                                name="amount"
                                                type="text"
                                                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                                placeholder="1.500,00"
                                                value={draftAmount}
                                                onChange={(e) => setDraftAmount(e.target.value)}
                                            />
                                        </div>
                                    </>
                                ) : isProduct ? (
                                    <>
                                        <div className="mb-4">
                                            <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer group">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="p-2 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                                                        <Upload className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-sm font-medium text-primary">Importar XML (Nota de Compra)</p>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">Preenche NCM, Descrição e Valores automaticamente</p>
                                                    </div>
                                                </div>
                                                <input type="file" accept=".xml" className="hidden" onChange={handleXmlImport} />
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1">NCM</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                                    placeholder="0000.00.00"
                                                    value={draftNcm}
                                                    onChange={(e) => setDraftNcm(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1">CFOP</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                                    placeholder="5102 / 5405"
                                                    value={draftCfop}
                                                    onChange={(e) => setDraftCfop(e.target.value)}
                                                />
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <input
                                                        type="checkbox"
                                                        id="interstate-sale"
                                                        checked={isInterstate}
                                                        onChange={(e) => {
                                                            setIsInterstate(e.target.checked);
                                                            if (draftCfop === '5102' && e.target.checked) setDraftCfop('6102');
                                                            if (draftCfop === '6102' && !e.target.checked) setDraftCfop('5102');
                                                        }}
                                                        className="rounded border-border text-primary focus:ring-primary"
                                                    />
                                                    <label htmlFor="interstate-sale" className="text-[10px] text-muted-foreground cursor-pointer">
                                                        Venda p/ outro Estado
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição do Produto (Identificação)</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                                placeholder="Placa Mãe XYZ"
                                                value={draftDescription}
                                                onChange={(e) => setDraftDescription(e.target.value)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1">Unid.</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary uppercase"
                                                    placeholder="UN"
                                                    value={draftUnit}
                                                    onChange={(e) => setDraftUnit(e.target.value.toUpperCase())}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1">Qtde.</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    required
                                                    className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                                    placeholder="1"
                                                    value={draftQuantity}
                                                    onChange={(e) => setDraftQuantity(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1">Vlr Unit. (R$)</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                                    placeholder="100,00"
                                                    value={draftUnitPrice}
                                                    onChange={(e) => setDraftUnitPrice(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Valor Total (R$) <span className="text-[10px] text-primary">(Editável)</span></label>
                                            <input
                                                required
                                                name="amount"
                                                type="text"
                                                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                                placeholder="0,00"
                                                value={draftAmount}
                                                onChange={(e) => {
                                                    setDraftAmount(e.target.value);
                                                    setIsManualAmount(true);
                                                }}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-muted-foreground mb-1">Valor da Nota (R$)</label>
                                        <input
                                            required
                                            name="amount"
                                            type="text"
                                            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                            placeholder="1.500,00"
                                            value={draftAmount}
                                            onChange={(e) => setDraftAmount(e.target.value)}
                                        />
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Check className="h-5 w-5" />
                                    {invoiceToEdit ? 'Salvar Alterações' : 'Salvar Registro no ERP'}
                                </button>
                            </form>

                            {/* Right Side: Draft Sync for MEI */}
                            {isMEIDraftView && (
                                <div className="p-5 w-full md:w-1/2 bg-muted/10 relative flex flex-col hide-scrollbar">
                                    <h4 className="font-bold flex items-center gap-2 mb-2">
                                        Rascunho Inteligente
                                        <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">Ativo</span>
                                    </h4>
                                    <p className="text-sm text-muted-foreground mb-6">
                                        Use os botões de copiar para preencher o Emissor {invoiceType === 'service' ? 'Governo' : 'SEFAZ'} sem erros.
                                    </p>

                                    <div className="space-y-4 flex-1">
                                        {/* Common Draft Fields */}
                                        <div className="flex gap-2 items-center">
                                            <div className="flex-1">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">CNPJ / CPF do Destinatário</p>
                                                <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm flex items-center justify-between min-h-[40px]">
                                                    <span className={draftClientDocument ? "text-foreground" : "text-muted-foreground italic"}>
                                                        {draftClientDocument || "Aguardando preenchimento..."}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(draftClientDocument, 'doc')}
                                                className="mt-4 p-2.5 bg-background border border-border hover:bg-muted rounded-lg transition-colors group relative shrink-0"
                                            >
                                                {copiedField === 'doc' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />}
                                            </button>
                                        </div>

                                        <div className="flex gap-2 items-center">
                                            <div className="flex-1">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">CEP Destino (Autocompletar)</p>
                                                <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm flex items-center justify-between min-h-[40px]">
                                                    <span className={draftCep ? "text-foreground" : "text-muted-foreground italic"}>
                                                        {draftCep || "Aguardando preenchimento..."}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(draftCep, 'cep')}
                                                className="mt-4 p-2.5 bg-background border border-border hover:bg-muted rounded-lg transition-colors group relative shrink-0"
                                            >
                                                {copiedField === 'cep' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />}
                                            </button>
                                        </div>

                                        {/* Product Specific fields */}
                                        {isProduct && (
                                            <div className="flex gap-2 w-full">
                                                <div className="flex-1 flex gap-2 items-center">
                                                    <div className="flex-1">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">NCM</p>
                                                        <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm flex items-center justify-between min-h-[40px] truncate">
                                                            <span>{draftNcm || "-"}</span>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => handleCopy(draftNcm, 'ncm')} className="mt-4 p-2.5 bg-background border border-border hover:bg-muted rounded-lg shrink-0">
                                                        {copiedField === 'ncm' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                                                    </button>
                                                </div>
                                                <div className="flex-1 flex gap-2 items-center">
                                                    <div className="flex-1">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">CFOP</p>
                                                        <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm flex items-center justify-between min-h-[40px] truncate">
                                                            <span>{draftCfop || "-"}</span>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => handleCopy(draftCfop, 'cfop')} className="mt-4 p-2.5 bg-background border border-border hover:bg-muted rounded-lg shrink-0">
                                                        {copiedField === 'cfop' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Description */}
                                        <div className="flex gap-2 items-start">
                                            <div className="flex-1">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">
                                                    {isProduct ? 'Descrição Produto' : 'Discriminação Serviço'}
                                                </p>
                                                <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm flex items-start justify-between min-h-[60px] max-h-[100px] overflow-auto custom-scrollbar">
                                                    <span className={draftDescription ? "text-foreground" : "text-muted-foreground italic"}>
                                                        {draftDescription || "Aguardando preenchimento..."}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(draftDescription, 'desc')}
                                                className="mt-4 p-2.5 bg-background border border-border hover:bg-muted rounded-lg transition-colors group relative shrink-0"
                                            >
                                                {copiedField === 'desc' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />}
                                            </button>
                                        </div>

                                        {/* Quantity/Price for Product, Total for both */}
                                        {isProduct ? (
                                            <div className="flex gap-2 w-full">
                                                <div className="flex-1 flex gap-2 items-center">
                                                    <div className="flex-1">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">QTD</p>
                                                        <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm flex items-center justify-between min-h-[40px] truncate">
                                                            <span>{draftQuantity} {draftUnit}</span>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => handleCopy(draftQuantity, 'qtd')} className="mt-4 p-2.5 bg-background border border-border hover:bg-muted rounded-lg shrink-0">
                                                        {copiedField === 'qtd' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                                                    </button>
                                                </div>
                                                <div className="flex-1 flex gap-2 items-center">
                                                    <div className="flex-1">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">VLR UNIT.</p>
                                                        <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm flex items-center justify-between min-h-[40px] truncate">
                                                            <span>R$ {draftUnitPrice || "-"}</span>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => handleCopy(draftUnitPrice, 'unitprice')} className="mt-4 p-2.5 bg-background border border-border hover:bg-muted rounded-lg shrink-0">
                                                        {copiedField === 'unitprice' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 items-center">
                                                <div className="flex-1">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Valor Total</p>
                                                    <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm flex items-center justify-between min-h-[40px]">
                                                        <span className={draftAmount ? "text-foreground font-medium" : "text-muted-foreground italic"}>
                                                            {draftAmount ? `R$ ${draftAmount}` : "Aguardando preenchimento..."}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(draftAmount, 'amount')}
                                                    className="mt-4 p-2.5 bg-background border border-border hover:bg-muted rounded-lg transition-colors group relative shrink-0"
                                                >
                                                    {copiedField === 'amount' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-border shrink-0">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                const form = document.getElementById('invoice-form') as HTMLFormElement;
                                                if (form) {
                                                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                                                }
                                            }}
                                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg py-3 flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                                        >
                                            <Check className="h-4 w-4" />
                                            Já emiti na SEFAZ - Registrar Faturamento
                                        </button>
                                        <p className="text-center text-[10px] text-muted-foreground mt-2">
                                            Certifique-se de ter concluído a emissão no portal antes de registrar.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            ) : null}

            <FilePreviewModal 
                isOpen={previewData.isOpen}
                onClose={() => setPreviewData(prev => ({ ...prev, isOpen: false }))}
                fileUrl={previewData.url}
                fileName={previewData.name}
                fileType={previewData.type}
            />
        </div>
    );
};
