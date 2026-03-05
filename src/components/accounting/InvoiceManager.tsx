import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { FileText, Plus, Receipt, X, Download, ExternalLink } from 'lucide-react';
import { InvoiceType } from '@/types/accounting';
import { toast } from 'sonner';

export const InvoiceManager = () => {
    const { invoices, addInvoice, addEntry } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [invoiceType, setInvoiceType] = useState<InvoiceType>('service');

    const isMEI = activeCompany?.porte === 'MEI';
    const companyInvoices = invoices.filter(i => i.companyId === activeCompany?.id);

    const handleIssueInvoice = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        let rawAmount = formData.get('amount') as string;
        rawAmount = rawAmount.replace(/\./g, '').replace(',', '.');
        const amount = parseFloat(rawAmount);

        if (!activeCompany) {
            toast.error("Nenhuma empresa ativa.");
            return;
        }

        const inputNumber = formData.get('invoiceNumber') as string;
        const generatedNumber = inputNumber || `NF-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

        const newInvoice = {
            companyId: activeCompany.id,
            number: generatedNumber,
            issueDate: new Date().toISOString(),
            type: invoiceType,
            clientName: formData.get('clientName') as string,
            clientDocument: formData.get('clientDocument') as string,
            amount: amount,
            status: 'issued' as const,
        };

        addInvoice(newInvoice);

        // Ao registrar a NF, gera também uma receita provável no contas a receber
        addEntry({
            companyId: activeCompany.id,
            title: `Recebimento Ref. ${newInvoice.number} - ${newInvoice.clientName}`,
            amount: amount,
            date: new Date().toISOString(),
            type: 'revenue',
            categoryId: invoiceType === 'service' ? 'cat-rev-2' : 'cat-rev-1',
            status: 'pending'
        });

        toast.success(`Nota Fiscal de ${invoiceType === 'service' ? 'Serviço' : 'Produto'} registrada com sucesso!`);
        setIsFormOpen(false);
    };

    const handleDownloadInvoice = (invoice: any) => {
        // Since we are tracking manually now, we just output a text summary
        const content = `
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

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${invoice.number}.txt`; // Use .txt for the simulation
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Download da nota ${invoice.number} concluído.`);
    };

    return (
        <div className="kanban-card rounded-xl border border-border shadow-sm flex flex-col h-full">
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
                        Sefaz Estadual
                    </span>
                </button>
            </div>

            <div className="p-4 flex-1 overflow-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Controle de NFs Emitidas</h4>
                    <span className="text-[10px] text-muted-foreground">Total: {companyInvoices.length}</span>
                </div>
                {companyInvoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-xl bg-muted/20 text-muted-foreground/60">
                        <FileText className="h-10 w-10 mb-2 opacity-50" />
                        <span className="text-sm font-medium">Nenhuma nota fisca foi registrada ainda.</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {companyInvoices.slice().reverse().map(invoice => (
                            <div key={invoice.id} className="flex justify-between items-center bg-muted/20 p-3 rounded-xl border border-border hover:border-border/80 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg flex items-center justify-center ${invoice.type === 'service' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-foreground">{invoice.number}</p>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/10 text-muted-foreground font-medium uppercase tracking-wider">
                                                {invoice.type === 'service' ? 'NFS-E' : 'NF-E'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[150px]" title={invoice.clientName}>
                                            Cliente: ${invoice.clientName}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-sm text-foreground">R$ {invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    <div className="flex items-center justify-end gap-2 mt-1.5">
                                        <span className="text-[10px] text-muted-foreground/60">{new Date(invoice.issueDate).toLocaleDateString('pt-BR')}</span>
                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-1.5 rounded font-bold uppercase">Registrada</span>
                                        <button
                                            onClick={() => handleDownloadInvoice(invoice)}
                                            className="p-1 rounded bg-muted hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                                            title="Ver Resumo (TXT)"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isFormOpen && document.body ? createPortal(
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl border border-border w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                            <h3 className="font-bold flex items-center gap-2">
                                <Receipt className="h-5 w-5 text-primary" />
                                Registrar NF de {invoiceType === 'service' ? 'Serviço (NFS-e)' : 'Produto (NF-e)'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleIssueInvoice} className="p-5 space-y-4">
                            <h4 className="font-bold">Registrar NF de {invoiceType === 'service' ? 'Serviço (NFS-e)' : 'Produto (NF-e)'}</h4>
                            <p className="text-sm text-muted-foreground mb-4">
                                Preencha os dados da nota emitida externamente no portal governamental para fins de acompanhamento financeiro.
                            </p>

                            {isMEI && invoiceType === 'service' ? (
                                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                    <p className="text-xs text-amber-600 font-medium mb-3">
                                        MEIs devem emitir a nota oficial diretamente pelo <strong>Portal Nacional (Gov.br)</strong>. Emita lá gratuitamente e depois registre o faturamento aqui.
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
                            ) : (
                                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                    <p className="text-xs text-blue-600 font-medium mb-3">
                                        Empresas ME/EPP ou emissões de Produto utilizam o sistema da Prefeitura ou SEFAZ Estadual. Emita a nota gratuitamente no portal oficial e registre abaixo.
                                    </p>
                                    <a
                                        href={invoiceType === 'service' ? "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/servicos-para-mei/nota-fiscal" : "https://www.nfe.fazenda.gov.br/portal/"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-2 w-full bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg py-2 transition-colors text-xs"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        {invoiceType === 'service' ? 'Buscar Portal da Prefeitura' : 'Acessar Portal da NF-e (SEFAZ)'}
                                    </a>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1.5">Número da NF (Opcional)</label>
                                <input
                                    type="text"
                                    name="invoiceNumber"
                                    placeholder="Ex: NF-1044"
                                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do Cliente/Órgão</label>
                                <input required name="clientName" type="text" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" placeholder="Prefeitura Municipal..." />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">CNPJ/CPF</label>
                                <input required name="clientDocument" type="text" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" placeholder="00.000.000/0001-00" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Valor da Nota (R$)</label>
                                <input required name="amount" type="text" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" placeholder="1.500,00" />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg py-2.5 mt-2 transition-colors"
                            >
                                Registrar Lançamento de NF
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            ) : null}
        </div>
    );
};
