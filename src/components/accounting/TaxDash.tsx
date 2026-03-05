import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { Calculator, Settings, CheckCircle, Edit, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export const TaxDash = () => {
    const { taxObligations, settings, calculateTaxes, updateSettings, payTax, entries, updateTaxObligation, deleteTaxObligation } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    const [showPaid, setShowPaid] = useState(false);
    const [taxToEdit, setTaxToEdit] = useState<any>(null);

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYear = String(now.getFullYear());

    const companyTaxes = taxObligations.filter(t => t.companyId === activeCompany?.id);
    const visibleTaxes = companyTaxes.filter(t => showPaid ? true : t.status === 'pending');

    const companySettings = activeCompany ? settings[activeCompany.id] : null;
    const isMEI = activeCompany?.porte === 'MEI';

    // Current Minimum Wage Logic to show Breakdown
    const taxYear = parseInt(currentYear);
    const minWages: Record<number, number> = { 2024: 1412, 2025: 1518, 2026: 1621, 2027: 1720 };
    const baseWage = minWages[taxYear] || minWages[2026];
    const inss = baseWage * 0.05;

    let additionalTax = 0;
    const meiActivity = companySettings?.meiActivityType || 'service';
    if (meiActivity === 'commerce') additionalTax = 1.00;
    else if (meiActivity === 'service') additionalTax = 5.00;
    else if (meiActivity === 'both') additionalTax = 6.00;

    const totalMeiDas = inss + additionalTax;

    // Calculate annual revenue to check against MEI limit (81k)
    const annualRevenue = entries
        .filter(e => e.companyId === activeCompany?.id && e.type === 'revenue' && e.date.startsWith(currentYear))
        .reduce((sum, e) => sum + e.amount, 0);

    const meiLimit = 81000;
    const meiWarningThreshold = meiLimit * 0.8; // 80% do limite
    const isNearMeiLimit = isMEI && annualRevenue >= meiWarningThreshold;

    useEffect(() => {
        if (activeCompany) {
            // Se as configurações não existem, cria as configurações padrão (Simples Nacional, 6%)
            if (!companySettings && !isMEI) {
                updateSettings(activeCompany.id, { taxRegime: 'simples_nacional', taxRatePercentage: 6 });
            }
            // Auto calculate every time component mounts or company changes
            calculateTaxes(activeCompany.id, currentMonth, activeCompany.porte);
        }
    }, [activeCompany, companySettings, currentMonth, calculateTaxes, updateSettings, isMEI]);

    const handleSaveSettings = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        if (activeCompany) {
            if (isMEI) {
                const meiActivityType = formData.get('meiActivityType') as 'commerce' | 'service' | 'both';
                updateSettings(activeCompany.id, { meiActivityType });
                toast.success("Atividade MEI atualizada com sucesso.");
            } else {
                const taxRate = parseFloat(formData.get('taxRate') as string);
                const taxRegime = formData.get('taxRegime') as 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
                updateSettings(activeCompany.id, { taxRegime, taxRatePercentage: taxRate });
                toast.success("Configurações tributárias atualizadas.");
            }
            calculateTaxes(activeCompany.id, currentMonth, activeCompany.porte); // Recalculate immediately
        }
    };

    const handleSaveApiSettings = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        if (activeCompany) {
            const nfeEnvironment = formData.get('nfeEnvironment') as 'homologacao' | 'producao';
            const nfeApiToken = formData.get('nfeApiToken') as string;
            updateSettings(activeCompany.id, { nfeEnvironment, nfeApiToken });
            toast.success("Credenciais da API de NFe atualizadas com sucesso!");
        }
    };

    const handlePay = (id: string) => {
        payTax(id);
        toast.success("Obrigação fiscal baixada como PAGA.");
    };

    const handleDeleteTax = (id: string) => {
        if (confirm("Tem certeza que deseja excluir esta obrigação? Isso não poderá ser desfeito.")) {
            deleteTaxObligation(id);
            toast.info("Obrigação fiscal removida.");
        }
    };

    const handleSaveEditTax = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        const amount = parseFloat((formData.get('amount') as string).replace(/\./g, '').replace(',', '.'));
        const dueDate = formData.get('dueDate') as string;

        if (taxToEdit) {
            updateTaxObligation(taxToEdit.id, { name, amount, dueDate });
            toast.success("Imposto ajustado manualmente com sucesso!");
            setTaxToEdit(null);
        }
    };

    return (
        <div className="kanban-card rounded-xl border border-border shadow-sm flex flex-col h-full bg-gradient-to-br from-background to-muted/10">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    Inteligência Tributária
                </h3>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-y-auto custom-scrollbar">

                {/* Métricas e Obrigações */}
                <div className="md:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            Obrigações e Guias Mensais
                        </h4>
                        <button
                            onClick={() => setShowPaid(!showPaid)}
                            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors bg-muted/30 px-2 py-1 rounded"
                        >
                            {showPaid ? (
                                <><EyeOff className="h-3.5 w-3.5" /> Ocultar Pagos</>
                            ) : (
                                <><Eye className="h-3.5 w-3.5" /> Ver Pagos</>
                            )}
                        </button>
                    </div>

                    {visibleTaxes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl bg-muted/20 text-muted-foreground/60">
                            <span className="text-sm font-medium">Nenhuma obrigação {showPaid ? 'encontrada' : 'pendente'} para exibição.</span>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {visibleTaxes.map(tax => (
                                <div key={tax.id} className={`group flex justify-between items-center p-4 rounded-xl border transition-colors ${tax.status === 'paid' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-muted/20 hover:border-border/80'}`}>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-bold text-sm text-foreground">{tax.name}</p>
                                            {tax.status === 'paid' && <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded font-bold uppercase">Pago</span>}
                                        </div>
                                        <p className="text-xs text-muted-foreground">Competência: {tax.month}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Vencimento: {tax.dueDate.split('-').reverse().join('/')}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className={`font-bold text-lg ${tax.status === 'paid' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                R$ {tax.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                            <div className="flex items-center justify-end gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setTaxToEdit(tax)}
                                                    className="p-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors"
                                                    title="Editar Valor / Vencimento"
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTax(tax.id)}
                                                    className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors"
                                                    title="Excluir Guia"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {tax.status === 'pending' && (
                                            <button
                                                onClick={() => handlePay(tax.id)}
                                                className="bg-primary hover:bg-primary/90 text-primary-foreground p-3 rounded-lg flex gap-2 items-center text-xs font-medium transition-colors"
                                                title="Marcar como Pago"
                                            >
                                                <CheckCircle className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Configurações Tributárias */}
                <div className="border border-border rounded-xl p-4 bg-muted/10 h-max">
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-4">
                        <Settings className="h-4 w-4" />
                        {isMEI ? 'Dashboard MEI' : 'Ajuste de Parâmetros'}
                    </h4>

                    {isNearMeiLimit && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-xs text-red-500 font-bold mb-1">⚠️ Atenção: Limite do MEI Próximo!</p>
                            <p className="text-[10px] text-red-500/80">
                                Sua receita anual já atingiu R$ {annualRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ 81.000,00 permitidos. Considere falar com um contador sobre o reenquadramento para ME.
                            </p>
                        </div>
                    )}

                    {!isMEI && (
                        <form onSubmit={handleSaveSettings} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Regime Tributário</label>
                                <select
                                    name="taxRegime"
                                    defaultValue={companySettings?.taxRegime || 'simples_nacional'}
                                    className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                >
                                    <option value="simples_nacional">Simples Nacional</option>
                                    <option value="lucro_presumido">Lucro Presumido</option>
                                    <option value="lucro_real">Lucro Real</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Alíquota Efetiva (%)</label>
                                <input
                                    required
                                    name="taxRate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={companySettings?.taxRatePercentage || 6}
                                    className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                />
                            </div>
                            <button type="submit" className="w-full bg-primary/20 hover:bg-primary/30 text-primary font-medium rounded-lg py-2 mt-2 transition-colors text-sm border border-primary/30">
                                Atualizar Cálculo
                            </button>
                        </form>
                    )}

                    {isMEI && (
                        <div className="space-y-4">
                            <form onSubmit={handleSaveSettings} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Ramo de Atividade (MEI)</label>
                                    <select
                                        name="meiActivityType"
                                        defaultValue={companySettings?.meiActivityType || 'service'}
                                        className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                    >
                                        <option value="commerce">Comércio ou Indústria (INSS + ICMS)</option>
                                        <option value="service">Prestação de Serviços (INSS + ISS)</option>
                                        <option value="both">Comércio e Serviços (INSS + ICMS + ISS)</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full bg-primary/20 hover:bg-primary/30 text-primary font-medium rounded-lg py-2 transition-colors text-sm border border-primary/30">
                                    Atualizar Guia Mensal
                                </button>
                            </form>

                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <p className="text-xs text-emerald-500 font-bold mb-2">Estimativa do Valor Fixo DAS ({taxYear})</p>
                                <div className="space-y-1 text-[11px] text-muted-foreground">
                                    <div className="flex justify-between">
                                        <span>INSS (5% do Mínimo R$ {baseWage})</span>
                                        <span>R$ {inss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    {(meiActivity === 'commerce' || meiActivity === 'both') && (
                                        <div className="flex justify-between">
                                            <span>ICMS (Estado)</span>
                                            <span>R$ 1,00</span>
                                        </div>
                                    )}
                                    {(meiActivity === 'service' || meiActivity === 'both') && (
                                        <div className="flex justify-between">
                                            <span>ISS (Município)</span>
                                            <span>R$ 5,00</span>
                                        </div>
                                    )}
                                    <div className="border-t border-emerald-500/20 pt-1 mt-1 flex justify-between font-bold text-emerald-500">
                                        <span>Total Base</span>
                                        <span>R$ {totalMeiDas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-border/50">
                                <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2 mb-2">
                                    <span className="text-muted-foreground">Faturamento Anual Acumulado</span>
                                    <span className="font-bold">R$ {annualRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Teto MEI Permitido</span>
                                    <span className="font-bold">R$ 81.000,00</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isMEI && (
                        <div className="mt-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <p className="text-[10px] text-amber-500 font-medium">
                                Aviso: O cálculo automático extrai a base de cálculo diretamente das Receitas recebidas dentro da competência (Regime de Caixa simplificado).
                            </p>
                        </div>
                    )}
                    {/* API Integration hidden per user request for manual entry logic
                    <div className="mt-6 pt-6 border-t border-border/50">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-4">
                            Integração API NFe (Ex: Focus NFe)
                        </h4>
                        ... rest of form ...
                    </div>
                    */}
                </div>

            </div>

            {taxToEdit && document.body && createPortal(
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl border border-border w-full max-w-sm flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                            <h3 className="font-bold flex items-center gap-2">
                                <Edit className="h-5 w-5 text-primary" />
                                Alterar Obrigação Fiscal
                            </h3>
                            <button onClick={() => setTaxToEdit(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveEditTax} className="p-5 space-y-4">
                            <p className="text-xs text-muted-foreground mb-4">
                                Use este recurso para alterar o valor pré-calculado pelo sistema para o valor exato emitido pela contabilidade na guia se houver divergência.
                            </p>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Nome / Descrição</label>
                                <input required name="name" type="text" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" defaultValue={taxToEdit.name} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Valor do Imposto (R$)</label>
                                <input required name="amount" type="text" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary font-mono" defaultValue={taxToEdit.amount.toFixed(2).replace('.', ',')} onChange={(e) => { e.target.value = e.target.value.replace(/[^0-9,]/g, ''); }} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Data de Vencimento</label>
                                <input required name="dueDate" type="date" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" defaultValue={taxToEdit.dueDate} />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors mt-2"
                            >
                                <CheckCircle className="h-5 w-5" />
                                Salvar Correção Contábil
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
