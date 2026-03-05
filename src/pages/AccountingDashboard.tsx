import { useState, useMemo } from 'react';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { ArrowUpRight, ArrowDownRight, DollarSign, Activity, FileText, AlertCircle, TrendingUp, TrendingDown, Clock, Receipt, Filter, BarChart3, AlertTriangle } from 'lucide-react';
import { AccountantExportPanel } from '@/components/accounting/AccountantExportPanel';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InvoiceManager } from '@/components/accounting/InvoiceManager';
import { XmlImporter } from '@/components/accounting/XmlImporter';
import { BankReconciliation } from '@/components/accounting/BankReconciliation';
import { CobrancasPanel } from '@/components/accounting/CobrancasPanel';
import { TaxDash } from '@/components/accounting/TaxDash';
import { ProLaboreDash } from '@/components/accounting/ProLaboreDash';

type FilterMode = 'current_month' | 'specific_month' | 'specific_year' | 'all';
const AccountingDashboard = () => {
    const { entries, invoices, categories } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    // Robust Time Filter State
    const [filterMode, setFilterMode] = useState<FilterMode>('current_month');
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const isDateInFilter = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        if (filterMode === 'current_month') {
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        if (filterMode === 'specific_month') {
            const [year, month] = selectedMonth.split('-');
            return d.getFullYear() === parseInt(year) && d.getMonth() === parseInt(month) - 1;
        }
        if (filterMode === 'specific_year') {
            return d.getFullYear() === selectedYear;
        }
        return true;
    };

    // Filtrar pela empresa ativa e pelo período selecionado
    const companyEntries = useMemo(() => {
        return entries.filter(e => {
            if (e.companyId !== activeCompany?.id) return false;
            return isDateInFilter(e.date);
        });
    }, [entries, activeCompany?.id, filterMode, selectedMonth, selectedYear]);

    const companyInvoices = useMemo(() => {
        return invoices.filter(i => {
            if (i.companyId !== activeCompany?.id) return false;
            return isDateInFilter(i.issueDate);
        });
    }, [invoices, activeCompany?.id, filterMode, selectedMonth, selectedYear]);

    // Invoice Metrics
    const totalInvoicesValue = companyInvoices.reduce((acc, curr) => acc + curr.amount, 0);
    const totalInvoicesCount = companyInvoices.length;

    // --- DRE Calculations ---
    const totalRevenue = companyEntries
        .filter(e => e.type === 'revenue' && e.status === 'paid')
        .reduce((acc, curr) => acc + curr.amount, 0);

    // CMV: Identifies specific categories related to cost of goods sold/suppliers
    // Assuming 'cat-exp-3' is the default 'Fornecedores' category
    const cmvExpenses = companyEntries
        .filter(e => e.type === 'expense' && e.status === 'paid' && e.categoryId === 'cat-exp-3')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const grossProfit = totalRevenue - cmvExpenses;
    const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

    // Operating Expenses (excluding CMV and Taxes)
    // Assuming 'cat-exp-2' is 'Impostos e Taxas' and 'cat-exp-3' is CMV
    const operatingExpenses = companyEntries
        .filter(e => e.type === 'expense' && e.status === 'paid' && !['cat-exp-2', 'cat-exp-3'].includes(e.categoryId))
        .reduce((acc, curr) => acc + curr.amount, 0);

    // EBIT (Lucro Operacional)
    const operatingProfit = grossProfit - operatingExpenses;
    const operatingMargin = totalRevenue > 0 ? ((operatingProfit / totalRevenue) * 100).toFixed(1) : 0;

    // Taxes
    const taxesPaid = companyEntries
        .filter(e => e.type === 'expense' && e.status === 'paid' && e.categoryId === 'cat-exp-2')
        .reduce((acc, curr) => acc + curr.amount, 0);

    // Net Income
    const netIncome = operatingProfit - taxesPaid;
    const netMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : 0;

    // Pending
    const pendingRevenue = companyEntries
        .filter(e => e.type === 'revenue' && e.status === 'pending')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const pendingExpense = companyEntries
        .filter(e => e.type === 'expense' && e.status === 'pending')
        .reduce((acc, curr) => acc + curr.amount, 0);

    // Cash Flow Forecast metrics (next 30 days independent of time filter, but filtered by company)
    const upcomingRevenue = entries
        .filter(e => e.companyId === activeCompany?.id && e.type === 'revenue' && e.status === 'pending' && e.date && new Date(e.date) <= new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000))
        .reduce((acc, curr) => acc + curr.amount, 0);

    const upcomingExpense = entries
        .filter(e => e.companyId === activeCompany?.id && e.type === 'expense' && e.status === 'pending' && e.date && new Date(e.date) <= new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000))
        .reduce((acc, curr) => acc + curr.amount, 0);

    const projectedCashflow = upcomingRevenue - upcomingExpense;

    // Chart Data Preparation - Historic Evolution
    const chartDataMap = new Map<string, { name: string; fullDate: Date; Receitas: number; Despesas: number; Saldo: number }>();

    // Group by month if filterMode is year or all, otherwise by day
    const groupByMonth = filterMode === 'specific_year' || filterMode === 'all';

    companyEntries.filter(e => e.status === 'paid').forEach(entry => {
        const date = new Date(entry.date);
        let dateKeyStr = '';
        let displayStr = '';

        if (groupByMonth) {
            dateKeyStr = `${date.getFullYear()}-${date.getMonth()}`;
            displayStr = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        } else {
            dateKeyStr = date.toISOString().split('T')[0];
            displayStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }

        if (!chartDataMap.has(dateKeyStr)) {
            chartDataMap.set(dateKeyStr, { name: displayStr, fullDate: date, Receitas: 0, Despesas: 0, Saldo: 0 });
        }

        const current = chartDataMap.get(dateKeyStr)!;
        if (entry.type === 'revenue') current.Receitas += entry.amount;
        if (entry.type === 'expense') current.Despesas += entry.amount;
        current.Saldo = current.Receitas - current.Despesas;
    });

    // Sort chronologically
    const chartData = Array.from(chartDataMap.values())
        .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime())
        .map(({ name, Receitas, Despesas, Saldo }) => ({ name, Receitas, Despesas, Saldo }));

    // Generate proactive alerts
    const alerts = [];
    if (netIncome < 0) {
        alerts.push({ type: 'danger', message: 'Atenção: A empresa está operando no vermelho no período selecionado.', icon: AlertTriangle });
    } else if (Number(netMargin) < 10 && totalRevenue > 0) {
        alerts.push({ type: 'warning', message: 'Margem líquida abaixo de 10%. Risco para o crescimento e blindagem do negócio.', icon: AlertCircle });
    }

    if (projectedCashflow < 0) {
        alerts.push({ type: 'warning', message: `Projeção de caixa para os próximos 30 dias é negativa (R$ ${Math.abs(projectedCashflow).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`, icon: TrendingDown });
    }

    const totalExpense = cmvExpenses + operatingExpenses + taxesPaid;

    // --- Advanced Parâmetros Focados em Licitações ---
    const revenueCount = companyEntries.filter(e => e.type === 'revenue' && e.status === 'paid').length;
    const ticketMedio = revenueCount > 0 ? (totalRevenue / revenueCount) : 0;

    const inadimplencia = companyEntries.filter(e => e.type === 'revenue' && e.status === 'pending' && e.date && new Date(e.date) < new Date(new Date().setHours(0, 0, 0, 0))).reduce((acc, curr) => acc + curr.amount, 0);

    const margemContribuicao = grossProfit - taxesPaid;
    const margemContribuicaoPercent = totalRevenue > 0 ? ((margemContribuicao / totalRevenue) * 100).toFixed(1) : "0";

    const breakEven = Number(margemContribuicaoPercent) > 0 ? (operatingExpenses / (Number(margemContribuicaoPercent) / 100)) : 0;

    const expenseMap = new Map<string, number>();
    companyEntries.filter(e => e.type === 'expense' && e.status === 'paid').forEach(e => {
        expenseMap.set(e.categoryId, (expenseMap.get(e.categoryId) || 0) + e.amount);
    });
    let maiorCustoKey = '';
    let maiorCustoValor = 0;
    expenseMap.forEach((val, key) => {
        if (val > maiorCustoValor) {
            maiorCustoValor = val;
            maiorCustoKey = key;
        }
    });
    const maiorCustoNome = categories.find(c => c.id === maiorCustoKey)?.name || 'N/A';
    const maiorCustoPercent = (totalExpense > 0 && maiorCustoValor > 0) ? ((maiorCustoValor / totalExpense) * 100).toFixed(1) : 0;

    const totalHistoricalRevenue = entries.filter(e => e.companyId === activeCompany?.id && e.type === 'revenue' && e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
    const totalHistoricalExpense = entries.filter(e => e.companyId === activeCompany?.id && e.type === 'expense' && e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
    const saldoAtualGlobal = totalHistoricalRevenue - totalHistoricalExpense;

    let runwayText = "Indefinido";
    if (operatingExpenses > 0) {
        const months = saldoAtualGlobal / operatingExpenses;
        runwayText = months > 0 ? `${months.toFixed(1)} Meses` : "Atenção (Critico)";
    } else if (saldoAtualGlobal > 0) {
        runwayText = "+12 Meses"
    }

    return (
        <div className="flex-1 bg-background text-foreground overflow-hidden flex flex-col">
            <div className="kanban-header h-12 flex items-center px-4 shrink-0 border-b border-border z-10">
                <h1 className="font-bold text-lg text-white">CONTÁBIL</h1>
                {activeCompany && (
                    <span className="ml-4 px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-medium border border-accent/30">
                        {activeCompany.nomeFantasia || activeCompany.razaoSocial}
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-6">
                    <Tabs defaultValue="dashboard" className="w-full">
                        <TabsList className="mb-6 bg-muted/40 border border-border p-1 w-full flex flex-wrap gap-1 h-auto justify-start overflow-x-auto hide-scrollbar">
                            <TabsTrigger value="dashboard" className="data-[state=active]:bg-background">Visão Geral (DRE)</TabsTrigger>
                            <TabsTrigger value="notas" className="data-[state=active]:bg-background">Logística NF (XML)</TabsTrigger>
                            <TabsTrigger value="banco" className="data-[state=active]:bg-background">Conciliação Bancária</TabsTrigger>
                            <TabsTrigger value="cobrancas" className="data-[state=active]:bg-background">Automações & Cobranças</TabsTrigger>
                            <TabsTrigger value="impostos" className="data-[state=active]:bg-background">Tributos & Saúde</TabsTrigger>
                            <TabsTrigger value="prolabore" className="data-[state=active]:bg-background text-emerald-500 font-bold flex items-center gap-1 shrink-0">
                                <DollarSign className="h-3 w-3" />
                                Pró-Labore (Simulador)
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="dashboard" className="space-y-6">

                            {/* Proactive Alerts */}
                            {alerts.length > 0 && (
                                <div className="space-y-2">
                                    {alerts.map((alert, i) => (
                                        <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${alert.type === 'danger' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                            }`}>
                                            <alert.icon className="h-5 w-5 shrink-0" />
                                            <p className="text-sm font-medium">{alert.message}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-bold">DRE & Indicadores</h2>
                                    <p className="text-xs text-muted-foreground mt-1">Demonstrativo de Resultados do Exercício e Margens</p>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-2 bg-muted/30 border border-border p-2 rounded-lg">
                                    <Filter className="h-4 w-4 text-muted-foreground mr-1" />
                                    <select
                                        value={filterMode}
                                        onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                                        className="bg-transparent text-sm border-none focus:ring-0 text-foreground cursor-pointer font-medium"
                                    >
                                        <option value="current_month">Mês Atual</option>
                                        <option value="specific_month">Mês Específico</option>
                                        <option value="specific_year">Ano Específico</option>
                                        <option value="all">Todo o Período</option>
                                    </select>

                                    {filterMode === 'specific_month' && (
                                        <input
                                            type="month"
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                            className="bg-background border border-border rounded-md text-sm px-2 py-1 focus:outline-none focus:border-primary"
                                        />
                                    )}

                                    {filterMode === 'specific_year' && (
                                        <input
                                            type="number"
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                            className="bg-background border border-border rounded-md text-sm px-2 py-1 focus:outline-none focus:border-primary w-24"
                                            min="2000"
                                            max="2100"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Standard Financial Metrics row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm">
                                    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                        <Receipt className="h-4 w-4" />
                                        <h3 className="text-sm font-medium">Notas Emitidas</h3>
                                    </div>
                                    <div className="text-2xl font-bold">R$ {totalInvoicesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    <p className="text-[10px] text-muted-foreground mt-1">{totalInvoicesCount} notas no período</p>
                                </div>

                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm">
                                    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                                        <h3 className="text-sm font-medium">A Receber</h3>
                                    </div>
                                    <div className="text-2xl font-bold text-emerald-500">R$ {pendingRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Faturamentos pendentes</p>
                                </div>

                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm">
                                    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                        <TrendingDown className="h-4 w-4 text-rose-500" />
                                        <h3 className="text-sm font-medium">A Pagar</h3>
                                    </div>
                                    <div className="text-2xl font-bold text-rose-500">R$ {pendingExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Despesas em aberto</p>
                                </div>

                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm relative overflow-hidden bg-blue-500/5">
                                    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <h3 className="text-sm font-medium">Previsão Real de Caixa</h3>
                                    </div>
                                    <div className={`text-2xl font-bold ${projectedCashflow >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                                        R$ {projectedCashflow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Próximos 30 dias globais</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* DRE Step 1: Revenue */}
                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
                                    <div className="flex items-center justify-between pb-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">Receita Bruta</h3>
                                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                                            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Faturamento total do período</p>
                                    </div>
                                </div>

                                {/* DRE Step 2: Gross Profit & CMV */}
                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all"></div>
                                    <div className="flex items-center justify-between pb-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">Lucro Bruto (CMV)</h3>
                                        <div className="p-2 bg-blue-500/10 rounded-lg flex items-center gap-1">
                                            <span className="text-xs font-bold text-blue-500">{grossMargin}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">R$ {grossProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <div className="flex items-center gap-1 mt-1">
                                            <p className="text-[10px] text-rose-500/70 font-medium">CMV: -R$ {cmvExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* DRE Step 3: Operating Profit (EBIT) */}
                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
                                    <div className="flex items-center justify-between pb-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">Lucro Operacional</h3>
                                        <div className="p-2 bg-amber-500/10 rounded-lg flex items-center gap-1">
                                            <span className="text-xs font-bold text-amber-500">{operatingMargin}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className={`text-2xl font-bold ${operatingProfit >= 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                                            R$ {operatingProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="flex items-center gap-1 mt-1">
                                            <p className="text-[10px] text-rose-500/70 font-medium">OpEx: -R$ {operatingExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* DRE Step 4: Net Income */}
                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all"></div>
                                    <div className="flex items-center justify-between pb-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">Lucro Líquido</h3>
                                        <div className="p-2 bg-indigo-500/10 rounded-lg flex items-center gap-1">
                                            <span className="text-xs font-bold text-indigo-500">{netMargin}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            R$ {netIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="flex items-center gap-1 mt-1">
                                            <p className="text-[10px] text-rose-500/70 font-medium">Impostos: -R$ {taxesPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="kanban-card rounded-xl border border-border lg:col-span-2 shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-primary" />
                                            Evolução do Fluxo de Caixa
                                        </h3>
                                    </div>
                                    <div className="h-72 w-full pt-4">
                                        {chartData.length === 0 ? (
                                            <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                                                <span className="text-muted-foreground text-sm">O histórico de movimentação não possui dados suficientes para projecão.</span>
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`} />
                                                    <Tooltip
                                                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }}
                                                        contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
                                                        itemStyle={{ fontWeight: 'bold' }}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                                    <Area type="monotone" dataKey="Receitas" stroke="#10b981" fillOpacity={1} fill="url(#colorReceita)" />
                                                    <Area type="monotone" dataKey="Saldo" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorSaldo)" />
                                                    <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <AccountantExportPanel />

                                    <div className="kanban-card rounded-xl border border-border shadow-sm flex flex-col">
                                        <div className="p-4 border-b border-border flex items-center justify-between">
                                            <h3 className="font-bold flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-primary" />
                                                Últimos Lançamentos
                                            </h3>
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col justify-center items-center text-center space-y-2 text-muted-foreground min-h-[200px]">
                                            {companyEntries.length === 0 ? (
                                                <>
                                                    <FileText className="h-8 w-8 opacity-20" />
                                                    <p className="text-sm">Nenhum lançamento encontrado para esta empresa.</p>
                                                </>
                                            ) : (
                                                <div className="w-full text-left space-y-3">
                                                    {companyEntries.slice(-5).reverse().map(entry => (
                                                        <div key={entry.id} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                                                            <div>
                                                                <p className="font-medium text-foreground">{entry.title}</p>
                                                                <p className="text-[10px] text-muted-foreground">{new Date(entry.date).toLocaleDateString('pt-BR')}</p>
                                                            </div>
                                                            <span className={`font-bold ${entry.type === 'revenue' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {entry.type === 'revenue' ? '+' : '-'} R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* --- Advanced KPI Grid --- */}
                            <div className="mt-8 mb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                                    <BarChart3 className="h-5 w-5 text-primary" />
                                    Métricas Avançadas de Governança
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <BarChart3 className="h-4 w-4 text-emerald-500" />
                                            <h3 className="text-sm font-medium">Ticket Médio (Vendas)</h3>
                                        </div>
                                        <div className="text-xl font-bold">R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Por recebimento pago no período</p>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <AlertCircle className="h-4 w-4 text-rose-500" />
                                            <h3 className="text-sm font-medium">Inadimplência Pública/Privada</h3>
                                        </div>
                                        <div className="text-xl font-bold text-rose-500">R$ {inadimplencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Soma de recebíveis atrasados</p>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group bg-indigo-500/5">
                                        <div className="flex items-center gap-2 mb-2 text-indigo-500">
                                            <ArrowUpRight className="h-4 w-4" />
                                            <h3 className="text-sm font-medium">Margem de Contribuição</h3>
                                        </div>
                                        <div className="text-xl font-bold text-indigo-500">R$ {margemContribuicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-[10px] text-indigo-500/70 font-medium mt-1">Sobra {margemContribuicaoPercent}% da receita para Custo Fixo e Lucro</p>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <Activity className="h-4 w-4 text-amber-500" />
                                            <h3 className="text-sm font-medium">Ponto de Equilíbrio (Break-even)</h3>
                                        </div>
                                        <div className="text-xl font-bold">R$ {breakEven.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Faturamento mín. para lucro zero (pagar OpEx e Impostos)</p>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <TrendingDown className="h-4 w-4 text-rose-500/70" />
                                            <h3 className="text-sm font-medium">Maior Centro de Custo</h3>
                                        </div>
                                        <div className="text-sm font-bold truncate" title={maiorCustoNome}>{maiorCustoNome}</div>
                                        <div className="flex items-center justify-between mt-1">
                                            <p className="text-xs font-bold text-rose-500">R$ {maiorCustoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            <p className="text-[10px] text-muted-foreground">{maiorCustoPercent}% de tudo gasto</p>
                                        </div>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group bg-emerald-500/5">
                                        <div className="flex items-center gap-2 mb-2 text-emerald-500">
                                            <Clock className="h-4 w-4" />
                                            <h3 className="text-sm font-medium">Runway (Fôlego Financeiro)</h3>
                                        </div>
                                        <div className="text-xl font-bold text-emerald-500">{runwayText}</div>
                                        <p className="text-[10px] text-emerald-500/70 font-medium mt-1">Sobrevivência c/ caixa atual x fluxo de OpEx atual</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="notas" className="space-y-6 h-[500px]">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                                <InvoiceManager />
                                <XmlImporter />
                            </div>
                        </TabsContent>

                        <TabsContent value="banco" className="space-y-6 h-[600px]">
                            <BankReconciliation />
                        </TabsContent>

                        <TabsContent value="cobrancas" className="space-y-6 h-[600px]">
                            <CobrancasPanel />
                        </TabsContent>

                        <TabsContent value="impostos" className="space-y-6 h-[600px]">
                            <TaxDash />
                        </TabsContent>

                        <TabsContent value="prolabore" className="space-y-6">
                            <ProLaboreDash />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

export default AccountingDashboard;
