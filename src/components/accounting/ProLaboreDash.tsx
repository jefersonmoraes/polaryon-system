import { useState, useMemo } from 'react';
import { Calculator, AlertTriangle, Users, DollarSign, TrendingUp, CheckCircle2, FileText } from 'lucide-react';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';

// INSS Teto e Alicota
const SALARIO_MINIMO = 1412.00; // 2024
const INSS_ALIQUOTA = 0.11; // 11% para Simples (Anexos I, II, III, V)
const INSS_TETO = 856.46; // Em 2024 (11% sobre R$ 7.786,02)

// IRRF 2024 Tabela Progressiva (Mensal)
const irrfTable = [
    { max: 2259.20, taxa: 0, deducao: 0 },
    { max: 2826.65, taxa: 0.075, deducao: 169.44 },
    { max: 3751.05, taxa: 0.15, deducao: 381.44 },
    { max: 4664.68, taxa: 0.225, deducao: 662.77 },
    { max: Infinity, taxa: 0.275, deducao: 896.00 }
];

export const ProLaboreDash = () => {
    const { settings, entries } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];
    const companySettings = activeCompany ? settings[activeCompany.id] : null;

    // Calcula faturamento médio mensal baseado nas entradas pagas
    const now = new Date();
    const currentYear = now.getFullYear();
    const totalYearRevenue = entries
        .filter(e => e.companyId === activeCompany?.id && e.type === 'revenue' && e.status === 'paid' && new Date(e.date).getFullYear() === currentYear)
        .reduce((acc, curr) => acc + curr.amount, 0);

    const pastMonthsCount = now.getMonth() + 1; // 1 for Jan, 2 for Feb, etc.
    const averageMonthlyRevenue = totalYearRevenue / pastMonthsCount;

    // States
    const [partnersCount, setPartnersCount] = useState<number>(2);
    const [totalProLabore, setTotalProLabore] = useState<string>("5000,00");
    const [dependentsPertner, setDependentsPartner] = useState<number>(0);

    // Calculation Logic
    const calculationResult = useMemo(() => {
        const grossTotal = parseFloat(totalProLabore.replace(/\./g, "").replace(",", ".")) || 0;

        if (partnersCount <= 0 || grossTotal <= 0) return null;

        const grossPerPartner = grossTotal / partnersCount;

        // 1. Calculate INSS
        let inssBase = grossPerPartner;
        let inssDiscount = inssBase * INSS_ALIQUOTA;
        if (inssDiscount > INSS_TETO) {
            inssDiscount = INSS_TETO;
        }

        // 2. Calculate IRRF
        // Deduct INSS and dependents (R$ 189,59 per dependent) from Base
        const deducaoPorDependente = 189.59;
        const totalDependentsDeduction = dependentsPertner * deducaoPorDependente;

        // IRRF Deduction Simplificada (Opção de 20% limitada a R$ 564,80) - Apenas para PJ usaremos a base normal, o desconto simplificado é mais para PF, mas a regra de pro-labore geralmente usa a legal dedutora exata:
        let irrfBase = grossPerPartner - inssDiscount - totalDependentsDeduction;

        let irrfDiscount = 0;
        let aliquotString = "0%";

        if (irrfBase > 0) {
            for (const faixa of irrfTable) {
                if (irrfBase <= faixa.max) {
                    irrfDiscount = (irrfBase * faixa.taxa) - faixa.deducao;
                    aliquotString = `${(faixa.taxa * 100).toFixed(1)}%`;
                    break;
                }
            }
        }
        if (irrfDiscount < 0) irrfDiscount = 0;

        const netPerPartner = grossPerPartner - inssDiscount - irrfDiscount;
        const totalNet = netPerPartner * partnersCount;
        const totalTaxCost = (inssDiscount + irrfDiscount) * partnersCount;

        // Fator R Check (Idealmente a folha + pro-labore deve ser >= 28% do faturamento para Simples Anexo V virar III)
        const fatorRRatio = averageMonthlyRevenue > 0 ? (grossTotal / averageMonthlyRevenue) * 100 : 0;

        // Impact Margin Check
        const isSafeMargin = grossTotal < (averageMonthlyRevenue * 0.3); // Safe rule: prolabore < 30% of average revenue

        return {
            grossPerPartner,
            inssDiscount,
            irrfDiscount,
            netPerPartner,
            totalNet,
            totalTaxCost,
            aliquotString,
            fatorRRatio,
            isSafeMargin
        };

    }, [partnersCount, totalProLabore, dependentsPertner, averageMonthlyRevenue]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold">Cálculo de Pró-Labore</h2>
                    <p className="text-xs text-muted-foreground mt-1">Simulação exata de remuneração de sócios (Retenção na Fonte)</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Inputs do Simulador */}
                <div className="kanban-card p-5 rounded-xl border border-border shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                        <Calculator className="h-5 w-5 text-primary" />
                        <h3 className="font-bold">Parâmetros Sociais</h3>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Quantidade de Sócios (Divisão Igualitária)</label>
                        <div className="flex items-center border border-border rounded-lg bg-background px-3 py-2">
                            <Users className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                            <input
                                type="number"
                                min={1}
                                step={1}
                                value={partnersCount}
                                onChange={(e) => setPartnersCount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-transparent text-sm focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Pró-labore Bruto Desejado (Total Mensal)</label>
                        <div className="flex items-center border border-border rounded-lg bg-background px-3 py-2">
                            <span className="text-muted-foreground text-sm mr-2 shrink-0">R$</span>
                            <input
                                type="text"
                                value={totalProLabore}
                                onChange={(e) => setTotalProLabore(e.target.value)}
                                className="w-full bg-transparent text-sm focus:outline-none"
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Dependentes por Sócio (Média)</label>
                        <input
                            type="number"
                            min={0}
                            step={1}
                            value={dependentsPertner}
                            onChange={(e) => setDependentsPartner(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full border border-border rounded-lg bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Reduz a base de cálculo do IRRF (R$ 189,59 / dep)</p>
                    </div>

                    <div className="mt-4 p-4 bg-muted/20 border border-border rounded-lg">
                        <h4 className="text-xs font-bold mb-2 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Faturamento Médio Base</h4>
                        <p className="text-sm">R$ {averageMonthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<span className="text-[10px] text-muted-foreground">/mês ({currentYear})</span></p>
                    </div>
                </div>

                {/* Exibição dos Resultados Individuais */}
                {calculationResult && (
                    <div className="lg:col-span-2 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Card Resumo Global */}
                            <div className="kanban-card p-5 rounded-xl border border-border shadow-sm bg-primary/5 border-primary/20">
                                <h3 className="font-bold text-primary flex items-center gap-2 mb-4">
                                    <DollarSign className="h-4 w-4" /> Desembolso Total da Empresa
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Folha de Sócios (Bruta):</span>
                                        <span className="font-medium">R$ {parseFloat(totalProLabore.replace(/\./g, "").replace(",", ".")).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-rose-500">Tributação e Encargos Totais:</span>
                                        <span className="text-rose-500 font-medium">- R$ {calculationResult.totalTaxCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="pt-2 border-t border-primary/20 flex justify-between items-center">
                                        <span className="font-bold">Líquido Creditado:</span>
                                        <span className="text-lg font-bold text-emerald-500">R$ {calculationResult.totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card Resumo Individual */}
                            <div className="kanban-card p-5 rounded-xl border border-border shadow-sm">
                                <h3 className="font-bold flex items-center gap-2 mb-4">
                                    <Users className="h-4 w-4 text-muted-foreground" /> Extrato por Sócio (Holerite)
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Pró-labore Bruto:</span>
                                        <span className="font-medium">R$ {calculationResult.grossPerPartner.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-rose-500">INSS (11% limit max):</span>
                                        <span className="text-rose-500 font-medium">-R$ {calculationResult.inssDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-rose-500">IRRF ({calculationResult.aliquotString}):</span>
                                        <span className="text-rose-500 font-medium">-R$ {calculationResult.irrfDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="pt-2 border-t border-border flex justify-between items-center">
                                        <span className="font-bold">Salário Líquido:</span>
                                        <span className="text-lg font-bold text-emerald-500">R$ {calculationResult.netPerPartner.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Alertas Inteligentes */}
                        <div className="space-y-3 pt-2">
                            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Consultoria & Diagnóstico Tributário</h3>

                            {calculationResult.fatorRRatio >= 28 && averageMonthlyRevenue > 0 ? (
                                <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-sm">Fator R Atingido: {calculationResult.fatorRRatio.toFixed(1)}% (Ótimo!)</p>
                                        <p className="text-xs mt-1 text-emerald-500/80">O custo com folha excede 28% do seu faturamento médio. Se você atua no Anexo V do Simples Nacional, poderá ser tributado pelo Anexo III (alíquota bem menor).</p>
                                    </div>
                                </div>
                            ) : averageMonthlyRevenue > 0 ? (
                                <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-500">
                                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-sm">Fator R Atual: {calculationResult.fatorRRatio.toFixed(1)}%</p>
                                        <p className="text-xs mt-1 text-blue-500/80">Caso sua empresa ofereça serviços do Anexo V (Simples Nac.), aumentar o Pró-labore para que represente 28% ou mais do faturamento médio pode reduzir drasticamente o DAS mensal transferindo-o pro Anexo III.</p>
                                    </div>
                                </div>
                            ) : null}

                            {!calculationResult.isSafeMargin && averageMonthlyRevenue > 0 && (
                                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500">
                                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-sm">Alerta de Margem de Segurança Empreendedora</p>
                                        <p className="text-xs mt-1 text-amber-500/80">O montante destinado aos sócios ultrapassa 30% do seu faturamento mensal atual. Certifique-se de que a Margem Líquida cobre este montante para não descapitalizar o negócio em meses de sazonalidade nas licitações.</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start gap-3 p-3 bg-muted/20 border border-border rounded-lg text-muted-foreground">
                                <FileText className="h-5 w-5 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-sm">Avisos Fiscais</p>
                                    <p className="text-xs mt-1">Rendimento de Pró-labore não é a mesma coisa que distribuição de lucros. O Pró-labore é tributado conforme regras trabalhistas, enquanto os dividendos podem ser isentos se a empresa tiver contabilidade e apurar lucro líquido de sobras.</p>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
