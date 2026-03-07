import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { RefreshCw, Trash2, CalendarDays, Receipt, FileText, DownloadCloud, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface AccountingTrashViewerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const AccountingTrashViewer = ({ open, onOpenChange }: AccountingTrashViewerProps) => {
    const {
        entries, restoreEntry,
        invoices, restoreInvoice,
        taxObligations, restoreTaxObligation,
        exports, restoreExport
    } = useAccountingStore();

    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    // Filter trashed items for current company
    const trashedEntries = entries.filter(e => e.companyId === activeCompany?.id && e.trashedAt);
    const trashedInvoices = invoices.filter(i => i.companyId === activeCompany?.id && i.trashedAt);
    const trashedTaxes = taxObligations.filter(t => t.companyId === activeCompany?.id && t.trashedAt);
    const trashedExports = exports.filter(e => e.companyId === activeCompany?.id && e.trashedAt);

    const totalTrashed = trashedEntries.length + trashedInvoices.length + trashedTaxes.length + trashedExports.length;

    const handleRestoreEntry = (id: string) => {
        restoreEntry(id);
        toast.success('Lançamento restaurado com sucesso!');
    };

    const handleRestoreInvoice = (id: string) => {
        restoreInvoice(id);
        toast.success('Nota Fiscal restaurada com sucesso!');
    };

    const handleRestoreTax = (id: string) => {
        restoreTaxObligation(id);
        toast.success('Guia de Imposto restaurada com sucesso!');
    };

    const handleRestoreExport = (id: string) => {
        restoreExport(id);
        toast.success('Exportação restaurada no histórico!');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] bg-background border border-border text-foreground max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0 mb-2">
                    <DialogTitle className="flex items-center gap-2 text-rose-500">
                        <Trash2 className="h-5 w-5" />
                        Lixeira Contábil
                    </DialogTitle>
                    <DialogDescription>
                        Arquivos, lançamentos e notas excluídos recentemente.{totalTrashed === 0 ? ' A lixeira está vazia.' : ` Encontrados ${totalTrashed} itens.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">

                    {totalTrashed > 0 && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3 text-yellow-600 -mb-2">
                            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                            <p className="text-sm leading-relaxed">Itens na lixeira por mais de 30 dias serão apagados permanentemente de forma automática.</p>
                        </div>
                    )}

                    {totalTrashed === 0 && (
                        <div className="h-48 flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                            <div className="text-center text-muted-foreground">
                                <Trash2 className="h-10 w-10 mx-auto opacity-20 mb-2" />
                                <p className="text-sm font-medium">Lixeira Vazia</p>
                            </div>
                        </div>
                    )}

                    {trashedEntries.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="font-bold text-sm flex items-center gap-2 border-b border-border/50 pb-2">
                                <CalendarDays className="h-4 w-4 text-emerald-500" />
                                Lançamentos DRE ({trashedEntries.length})
                            </h4>
                            <div className="space-y-2">
                                {trashedEntries.map(entry => (
                                    <div key={entry.id} className="flex items-center justify-between p-3 rounded border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                                        <div className="flex-1 truncate pr-4">
                                            <p className="font-semibold text-sm truncate">{entry.title}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${entry.type === 'revenue' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                                                    {entry.type === 'revenue' ? 'Receita' : 'Despesa'}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                <span className="text-[10px] text-muted-foreground">Excluído: {new Date(entry.trashedAt!).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRestoreEntry(entry.id)}
                                            className="p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors flex items-center gap-1 text-xs shrink-0"
                                            title="Restaurar item"
                                        >
                                            <RefreshCw className="h-3 w-3" /> Restaurar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {trashedInvoices.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="font-bold text-sm flex items-center gap-2 border-b border-border/50 pb-2">
                                <Receipt className="h-4 w-4 text-blue-500" />
                                Notas Fiscais ({trashedInvoices.length})
                            </h4>
                            <div className="space-y-2">
                                {trashedInvoices.map(inv => (
                                    <div key={inv.id} className="flex items-center justify-between p-3 rounded border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                                        <div className="flex-1 truncate pr-4">
                                            <p className="font-semibold text-sm truncate">NF {inv.number} - {inv.clientName}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] text-muted-foreground">R$ {inv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                <span className="text-[10px] text-muted-foreground">Excluído: {new Date(inv.trashedAt!).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRestoreInvoice(inv.id)}
                                            className="p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors flex items-center gap-1 text-xs shrink-0"
                                        >
                                            <RefreshCw className="h-3 w-3" /> Restaurar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {trashedTaxes.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="font-bold text-sm flex items-center gap-2 border-b border-border/50 pb-2">
                                <FileText className="h-4 w-4 text-orange-500" />
                                Guias de Tributos ({trashedTaxes.length})
                            </h4>
                            <div className="space-y-2">
                                {trashedTaxes.map(tax => (
                                    <div key={tax.id} className="flex items-center justify-between p-3 rounded border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                                        <div className="flex-1 truncate pr-4">
                                            <p className="font-semibold text-sm truncate">{tax.name} (Comp: {tax.month})</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] text-muted-foreground">R$ {tax.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                <span className="text-[10px] text-muted-foreground">Venc: {new Date(tax.dueDate).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRestoreTax(tax.id)}
                                            className="p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors flex items-center gap-1 text-xs shrink-0"
                                        >
                                            <RefreshCw className="h-3 w-3" /> Restaurar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {trashedExports.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="font-bold text-sm flex items-center gap-2 border-b border-border/50 pb-2">
                                <DownloadCloud className="h-4 w-4 text-purple-500" />
                                Exportações Geradas ({trashedExports.length})
                            </h4>
                            <div className="space-y-2">
                                {trashedExports.map(exp => (
                                    <div key={exp.id} className="flex items-center justify-between p-3 rounded border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                                        <div className="flex-1 truncate pr-4">
                                            <p className="font-semibold text-sm truncate">{exp.fileName}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-mono text-muted-foreground uppercase">{exp.type}</span>
                                                <span className="text-[10px] text-muted-foreground">Período: {exp.period}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRestoreExport(exp.id)}
                                            className="p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors flex items-center gap-1 text-xs shrink-0"
                                        >
                                            <RefreshCw className="h-3 w-3" /> Restaurar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
