import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { Download, FileDown, FileText, FileCode2, History, Trash2, RotateCcw, Activity, Eye, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { FilePreviewModal } from '../ui/FilePreviewModal';
import { jsPDF } from 'jspdf';
import { PdfDreReport } from './PdfDreReport';
import { PdfHealthReport } from './PdfHealthReport';

export const AccountantExportPanel = () => {
    const { entries, categories, exports, addExport, deleteExport, restoreExport } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');

    const companyEntries = entries.filter(e => e.companyId === activeCompany?.id && !e.trashedAt);
    const companyExports = exports.filter(e => e.companyId === activeCompany?.id && !e.trashedAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const [isGeneratingDre, setIsGeneratingDre] = useState(false);
    const [isGeneratingHealth, setIsGeneratingHealth] = useState(false);
    const dreRef = useRef<HTMLDivElement>(null);
    const healthRef = useRef<HTMLDivElement>(null);

    // Estado para Visualização Universal
    const [previewData, setPreviewData] = useState<{ isOpen: boolean; url: string; name: string; type?: string }>({
        isOpen: false,
        url: '',
        name: '',
    });

    const generatePdf = async (element: HTMLElement, filename: string, type: 'pdf_dre' | 'pdf_health', displayName: string) => {
        try {
            const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, logging: false });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [800, 1131]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, 800, 1131);

            pdf.save(filename);

            const pdfBase64 = pdf.output('datauristring');

            addExport({
                companyId: activeCompany!.id,
                type: type,
                period: new Date().toISOString().substring(0, 7),
                fileName: displayName,
                fileContent: pdfBase64
            });
            toast.success(`${displayName} gerado e salvo com sucesso!`);
        } catch (err) {
            console.error(err);
            toast.error(`Erro ao gerar ${displayName}.`);
        }
    };

    const handleGenerateDrePdf = async () => {
        if (!dreRef.current) return;
        setIsGeneratingDre(true);
        toast.loading("Gerando PDF da DRE, aguarde...");
        setTimeout(async () => {
            const fileName = `DRE_${activeCompany?.cnpj?.replace(/\D/g, '') || 'Empresa'}_${new Date().toISOString().split('T')[0]}.pdf`;
            await generatePdf(dreRef.current!, fileName, 'pdf_dre', `DRE em PDF - ${new Date().toLocaleDateString('pt-BR')}`);
            setIsGeneratingDre(false);
            toast.dismiss();
        }, 500);
    };

    const handleGenerateHealthPdf = async () => {
        if (!healthRef.current) return;
        setIsGeneratingHealth(true);
        toast.loading("Analisando métricas e gerando Saúde Financeira, aguarde...");
        setTimeout(async () => {
            const fileName = `SaudeFin_${activeCompany?.cnpj?.replace(/\D/g, '') || 'Empresa'}_${new Date().toISOString().split('T')[0]}.pdf`;
            await generatePdf(healthRef.current!, fileName, 'pdf_health', `Relatório de Saúde - ${new Date().toLocaleDateString('pt-BR')}`);
            setIsGeneratingHealth(false);
            toast.dismiss();
        }, 500);
    };

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
        link.click();
        document.body.removeChild(link);

        addExport({
            companyId: activeCompany!.id,
            type: 'csv',
            period: new Date().toISOString().substring(0, 7),
            fileName: `CSV Financeiro - ${new Date().toLocaleDateString('pt-BR')}`,
            fileContent: csvContent
        });

        toast.success('Arquivo CSV gerado com sucesso!');
    };

    const handleExportSintegra = () => {
        if (companyEntries.length === 0) {
            toast.error('Nenhum dado para exportar (Sintegra).');
            return;
        }

        const cnpj = activeCompany?.cnpj.replace(/\D/g, '').padEnd(14, '0') || '00000000000000';
        const ie = (activeCompany as any)?.inscricaoEstadual?.replace(/\D/g, '').padEnd(14, ' ') || 'ISENTO        ';
        const razao = (activeCompany?.razaoSocial || 'EMPRESA PADRAO').substring(0, 35).padEnd(35, ' ');
        const dataStr = new Date().toISOString().split('T')[0].replace(/-/g, '');

        // Header TIPO 10 (Mestre do Estabelecimento)
        let txtParams = `10${cnpj}${ie}${razao}curitiba            PR00${dataStr}209912313\r\n`;
        // Header TIPO 11 (Dados Complementares)
        txtParams += `11JARDIM BOTANICO                             00130               80210130CONTATO@EMPRESA.COMBR                                      041999999999\r\n`;

        // Registros TIPO 50 (Nota Fiscal - placeholder para as entradas e saídas)
        companyEntries.forEach((entry, i) => {
            const dataDoc = new Date(entry.date).toISOString().split('T')[0].replace(/-/g, '');
            const valFormated = (entry.amount * 100).toFixed(0).padStart(13, '0'); // Sem vírgulas (ex: 10,00 -> 0000000001000)
            const cpfCnpjDoc = (entry.documentEntityId || '').padEnd(14, ' ');
            const numDoc = (entry.documentNumber || `00000${i}`).padEnd(6, '0');

            txtParams += `50${cnpj}${cpfCnpjDoc}${dataDoc}PR55  ${numDoc} ${valFormated}${valFormated}00000000000000000000000000\r\n`;
        });

        // Trailer TIPO 90 (Totais)
        const totalLinhas = String(companyEntries.length + 3).padStart(8, '0');
        txtParams += `90${cnpj}${ie}50                           ${totalLinhas}1\r\n`;

        const blob = new Blob([txtParams], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SINTEGRA_${cnpj}_${dataStr}.txt`;
        link.click();
        URL.revokeObjectURL(url);

        addExport({
            companyId: activeCompany!.id,
            type: 'sintegra',
            period: new Date().toISOString().substring(0, 7),
            fileName: `SINTEGRA - Ref: ${new Date().toLocaleDateString('pt-BR')}`,
            fileContent: txtParams
        });
        toast.success("Arquivo SINTEGRA pré-formatado gerado.");
    };

    const handleExportSped = () => {
        if (companyEntries.length === 0) {
            toast.error('Nenhum dado para exportar (SPED).');
            return;
        }

        const cnpj = activeCompany?.cnpj.replace(/\D/g, '') || '';
        const curDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

        let txtParams = `|0000|015|0|01012023|31122023|${activeCompany?.razaoSocial || 'EMPRESA PADRAO'}|${cnpj}||PR||0000000|||A|1|\r\n`;
        txtParams += `|0001|0|\r\n`;
        txtParams += `|0100|CONTADOR NOME|00000000000|0000000|CONTADOR@EMAIL.COM|0000|\r\n`;

        companyEntries.forEach(entry => {
            txtParams += `|C100|0|1||55|00|000|${entry.documentNumber || '000000'}|${entry.date.replace(/-/g, '').substring(0, 8)}|${entry.date.replace(/-/g, '').substring(0, 8)}|${entry.amount}|1|0|0|0|0|0|0|0|0|0|0|\r\n`;
        });

        txtParams += `|C990|${companyEntries.length + 1}|\r\n`;
        txtParams += `|9001|0|\r\n`;
        txtParams += `|9990|2|\r\n`;
        txtParams += `|9999|5|\r\n`;

        const blob = new Blob([txtParams], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SPED_${cnpj}_${curDate}.txt`;
        link.click();
        URL.revokeObjectURL(url);

        addExport({
            companyId: activeCompany!.id,
            type: 'sped_efd',
            period: new Date().toISOString().substring(0, 7),
            fileName: `SPED EFD - Ref: ${new Date().toLocaleDateString('pt-BR')}`,
            fileContent: txtParams
        });
        toast.success("Arquivo SPED gerado (Layout ICMS/IPI).");
    };

    const availableYears = Array.from(new Set(companyExports.map(exp => exp.period.split('-')[0]))).filter(Boolean).sort().reverse();
    const availableMonths = [
        { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
        { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
        { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
        { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
        { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
        { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
    ];

    const filteredExports = companyExports.filter(exp => {
        const matchesSearch = exp.fileName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || exp.type === filterType;
        const expYear = exp.period.split('-')[0];
        const expMonth = exp.period.split('-')[1];
        const matchesYear = !filterYear || expYear === filterYear;
        const matchesMonth = !filterMonth || expMonth === filterMonth;
        return matchesSearch && matchesType && matchesYear && matchesMonth;
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div id="export-panel" className="kanban-card rounded-xl border border-border shadow-sm flex flex-col p-4">
                <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Download className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-bold">Gerar Relatórios Oficiais</h3>
                        <p className="text-xs text-muted-foreground">Exportações para seu contador / ERP</p>
                    </div>
                </div>

                <div className="space-y-3 mt-2">
                    <button
                        onClick={handleExportCSV}
                        className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                <FileDown className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm">Download CSV (Excel)</p>
                                <p className="text-[10px] text-muted-foreground">Formato padronizado para sistemas ERP (Entradas e Saídas)</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleExportSintegra}
                        className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <FileCode2 className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm">SINTEGRA (.txt)</p>
                                <p className="text-[10px] text-muted-foreground">Layout nacional padronizado (Convênio ICMS 57/95)</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleExportSped}
                        className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm">SPED EFD ICMS/IPI (.txt)</p>
                                <p className="text-[10px] text-muted-foreground">Escrituração Fiscal Digital (Geração de Blocos 0 e C)</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleGenerateDrePdf}
                        disabled={isGeneratingDre}
                        className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left group disabled:opacity-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm">Relatório DRE (PDF)</p>
                                <p className="text-[10px] text-muted-foreground">Demonstração do Resultado do Exercício formatada</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleGenerateHealthPdf}
                        disabled={isGeneratingHealth}
                        className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 transition-colors text-left group disabled:opacity-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <Activity className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">Termômetro de Saúde Financeira (PDF)</p>
                                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">Análise automática com gráficos e sugestões</p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            <div className="kanban-card rounded-xl border border-border shadow-sm flex flex-col p-4">
                <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <History className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-bold">Histórico de Arquivos</h3>
                            <p className="text-xs text-muted-foreground">Últimas gerações realizadas</p>
                        </div>
                    </div>
                </div>

                <div className="mb-4 flex flex-col gap-2">
                    <input
                        type="text"
                        placeholder="Pesquisar por nome do arquivo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                    />
                    <div className="flex gap-2">
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="flex-1 bg-secondary/50 text-foreground border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                            <option className="bg-background text-foreground" value="all">Todos os Tipos</option>
                            <option className="bg-background text-foreground" value="pdf_dre">DRE (PDF)</option>
                            <option className="bg-background text-foreground" value="pdf_health">Saúde Fin. (PDF)</option>
                            <option className="bg-background text-foreground" value="csv">Planilha (CSV)</option>
                            <option className="bg-background text-foreground" value="sped_efd">SPED EFD</option>
                            <option className="bg-background text-foreground" value="sintegra">SINTEGRA</option>
                        </select>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="bg-secondary/50 text-foreground border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                            <option className="bg-background text-foreground" value="">Qualquer Ano</option>
                            {availableYears.map(year => (
                                <option className="bg-background text-foreground" key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="flex-1 bg-secondary/50 text-foreground border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                            <option className="bg-background text-foreground" value="">Qualquer Mês</option>
                            {availableMonths.map(month => (
                                <option className="bg-background text-foreground" key={month.value} value={month.value}>{month.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 max-h-[350px] pr-2">
                    {filteredExports.length === 0 ? (
                        <div className="h-full min-h-[150px] flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                            <span className="text-muted-foreground text-sm">Nenhum histórico encontrado.</span>
                        </div>
                    ) : (
                        filteredExports.map(exp => (
                            <div key={exp.id} className="flex flex-col gap-1 p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-sm flex items-center gap-2">
                                            {exp.type === 'csv' && <FileDown className="h-3 w-3 text-emerald-500" />}
                                            {exp.type === 'sintegra' && <FileCode2 className="h-3 w-3 text-blue-500" />}
                                            {exp.type === 'sped_efd' && <FileText className="h-3 w-3 text-purple-500" />}
                                            {exp.type === 'pdf_dre' && <FileText className="h-3 w-3 text-rose-500" />}
                                            {exp.type === 'pdf_health' && <Activity className="h-3 w-3 text-emerald-500" />}
                                            {exp.fileName}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(exp.createdAt).toLocaleString('pt-BR')}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => {
                                                const isPdf = exp.type.includes('pdf');
                                                const isCsv = exp.type === 'csv';
                                                
                                                let url = exp.fileContent;
                                                // Se for texto puro (CSV/TXT), converter para data URL para o FilePreviewModal carregar no iframe se necessário
                                                // ou passar como está se o modal souber lidar.
                                                if (!url.startsWith('data:')) {
                                                    const mime = isCsv ? 'text/csv' : 'text/plain';
                                                    url = `data:${mime};base64,${btoa(unescape(encodeURIComponent(exp.fileContent)))}`;
                                                }

                                                setPreviewData({
                                                    isOpen: true,
                                                    url: url,
                                                    name: exp.fileName,
                                                    type: isPdf ? 'pdf' : (isCsv ? 'text' : 'text')
                                                });
                                            }}
                                            className="text-muted-foreground hover:text-primary p-1 rounded-md hover:bg-primary/10 transition-colors"
                                            title="Visualizar Arquivo"
                                        >
                                            <Search className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = exp.fileContent.startsWith('data:') ? exp.fileContent : `data:text/plain;charset=utf-8,${encodeURIComponent(exp.fileContent)}`;
                                                link.download = exp.fileName + (exp.type.includes('pdf') ? '.pdf' : exp.type === 'csv' ? '.csv' : '.txt');
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                            }}
                                            className="text-muted-foreground hover:text-primary p-1 rounded-md hover:bg-primary/10 transition-colors"
                                            title="Baixar Arquivo"
                                        >
                                            <Download className="h-4 w-4" />
                                        </button>
                                        <a
                                            href={exp.fileContent.startsWith('data:') ? exp.fileContent : `data:text/plain;charset=utf-8,${encodeURIComponent(exp.fileContent)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-muted-foreground hover:text-primary p-1 rounded-md hover:bg-primary/10 transition-colors"
                                            title="Abrir em Nova Aba"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                        <button
                                            onClick={() => {
                                                deleteExport(exp.id);
                                                toast.success('Registro de exportação movido para a lixeira.');
                                            }}
                                            className="text-muted-foreground hover:text-rose-500 p-1 rounded-md hover:bg-rose-500/10 transition-colors"
                                            title="Apagar do histórico"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Hidden elements for PDF Generation */}
            <div className="fixed top-[200%] left-[200%] opacity-0 pointer-events-none w-0 h-0 overflow-hidden">
                <PdfDreReport ref={dreRef} activeCompany={activeCompany} />
                <PdfHealthReport ref={healthRef} activeCompany={activeCompany} />
            </div>
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
