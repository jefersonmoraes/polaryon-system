import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { Download, FileDown, FileText } from 'lucide-react';
import { toast } from 'sonner';

export const AccountantExportPanel = () => {
    const { entries, categories } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    const companyEntries = entries.filter(e => e.companyId === activeCompany?.id);

    const handleExportCSV = () => {
        if (companyEntries.length === 0) {
            toast.error('Nenhum dado para exportar.');
            return;
        }

        // CSV Header for Accounting Systems
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "DATA,TIPO,CATEGORIA,TITULO,VALOR,STATUS\n";

        companyEntries.forEach(entry => {
            const category = categories.find(c => c.id === entry.categoryId);
            const dateStr = new Date(entry.date).toLocaleDateString('pt-BR');
            const typeStr = entry.type === 'revenue' ? 'ENTRADA' : 'SAIDA';
            const catName = category ? category.name.replace(/,/g, '') : 'Sem Categoria';
            const title = entry.title.replace(/,/g, ''); // prevent csv break
            const amount = entry.amount.toFixed(2).replace('.', ','); // BRL format
            const status = entry.status === 'paid' ? 'PAGO' : 'PENDENTE';

            csvContent += `${dateStr},${typeStr},${catName},${title},"${amount}",${status}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `exportacao_contabil_${activeCompany?.cnpj.replace(/\D/g, '') || 'empresa'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Arquivo CSV gerado com sucesso!');
    };

    return (
        <div id="export-panel" className="kanban-card rounded-xl border border-border shadow-sm flex flex-col p-4">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Download className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="font-bold">Exportação Contábil</h3>
                    <p className="text-xs text-muted-foreground">Gere relatórios para seu contador</p>
                </div>
            </div>

            <div className="space-y-3">
                <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left group"
                >
                    <div className="p-1.5 bg-emerald-500/10 rounded text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        <FileDown className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm">Download CSV (Excel)</p>
                        <p className="text-[10px] text-muted-foreground">Formato padronizado para sistemas ERP</p>
                    </div>
                </button>

                <button
                    onClick={() => toast.info('A geração de DRE em PDF será liberada na próxima atualização.')}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left group"
                >
                    <div className="p-1.5 bg-rose-500/10 rounded text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm">Relatório DRE (PDF)</p>
                        <p className="text-[10px] text-muted-foreground">Demonstração do Resultado do Exercício</p>
                    </div>
                </button>
            </div>
        </div>
    );
};
