import { useKanbanStore } from '@/store/kanban-store';
import { motion } from 'framer-motion';
import { X, Trash2, RefreshCw, AlertTriangle, Building2, Truck } from 'lucide-react';

interface CompanyArchiveViewerProps {
    onClose: () => void;
}

const CompanyArchiveViewer = ({ onClose }: CompanyArchiveViewerProps) => {
    const { companies, restoreCompany, permanentlyDeleteCompany } = useKanbanStore();
    const trashedItems = companies.filter(c => c.trashed);

    return (
        <>
            <div
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-popover border border-border shadow-2xl rounded-xl z-50 overflow-hidden flex flex-col max-h-[85vh]"
            >
                <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-destructive/10 text-destructive rounded-lg">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-foreground">Lixeira de Empresas</h2>
                            <p className="text-sm text-muted-foreground mt-0.5">Fornecedores e Transportadoras removidos ({trashedItems.length})</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-muted-foreground rounded hover:bg-muted transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-card">
                    {trashedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                            <div className="p-4 bg-muted rounded-full mb-4">
                                <Trash2 className="h-8 w-8 opacity-50" />
                            </div>
                            <p className="font-medium">A lixeira está vazia</p>
                            <p className="text-sm mt-1">Nenhuma empresa foi removida.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3 text-yellow-600 mb-6">
                                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                                <p className="text-sm leading-relaxed">Itens na lixeira por mais de 30 dias serão apagados permanentemente de forma automática.</p>
                            </div>

                            <div className="grid gap-3">
                                {trashedItems.map(item => (
                                    <div
                                        key={item.id}
                                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-background hover:border-primary/30 transition-colors shadow-sm"
                                    >
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className="shrink-0 p-2.5 bg-muted rounded-lg text-muted-foreground">
                                                {item.type === 'Fornecedor' ? <Building2 className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-sm text-foreground truncate">{item.nome_fantasia || item.razao_social}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{item.type}</span>
                                                    <span className="text-xs text-muted-foreground">CNPJ: {item.cnpj}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 sm:ml-auto w-full sm:w-auto">
                                            <button
                                                onClick={() => restoreCompany(item.id)}
                                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                                Restaurar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(`Tem certeza que deseja excluir "${item.razao_social}" permanentemente?`)) {
                                                        permanentlyDeleteCompany(item.id);
                                                    }
                                                }}
                                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Excluir
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </>
    );
};

export default CompanyArchiveViewer;
