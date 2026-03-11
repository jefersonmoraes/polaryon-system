import { useState, useMemo, useEffect } from 'react';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreditCard, TrendingUp, TrendingDown, DollarSign, FileText, ArrowUpRight, Activity, AlertCircle, AlertTriangle, Clock, BarChart3, PieChart as PieChartIcon, ArrowDownRight, LineChart as LineChartIcon, Building, ShieldCheck, Wallet, Receipt, Users, Target, Briefcase, Landmark, Shield, Scale, Gavel, Award, CalendarClock, Percent, Filter, ArrowLeftRight, Trash2 } from 'lucide-react';
import { AccountantExportPanel } from '@/components/accounting/AccountantExportPanel';
import { AccountingTrashViewer } from '@/components/accounting/AccountingTrashViewer';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, Legend, PieChart, Pie, Cell, BarChart, LineChart, Line } from 'recharts';
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
    const location = useLocation();
    const navigate = useNavigate();

    // Active Tab state read from URL params
    const queryParams = new URLSearchParams(location.search);
    const initialTab = queryParams.get('tab') || 'dashboard';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [trashViewerOpen, setTrashViewerOpen] = useState(false);

    useEffect(() => {
        const currentTab = queryParams.get('tab');
        if (currentTab && currentTab !== activeTab) {
            setActiveTab(currentTab);
        }
    }, [location.search]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        navigate(`/contabil?tab=${value}`, { replace: true });
    };

    // Robust Time Filter State
    const [filterMode, setFilterMode] = useState<FilterMode>('current_month');
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const isDateInFilter = (dateStr: string) => {
        if (!dateStr) return false;
        const [yearStr, monthStr] = dateStr.split('T')[0].split('-');
        const dYear = parseInt(yearStr, 10);
        const dMonth = parseInt(monthStr, 10) - 1;

        const now = new Date();
        if (filterMode === 'current_month') {
            return dMonth === now.getMonth() && dYear === now.getFullYear();
        }
        if (filterMode === 'specific_month') {
            const [year, month] = selectedMonth.split('-');
            return dYear === parseInt(year) && dMonth === parseInt(month) - 1;
        }
        if (filterMode === 'specific_year') {
            return dYear === selectedYear;
        }
        return true;
    };

    // Filtrar pela empresa ativa e pelo período selecionado e que não estejam na lixeira
    const companyEntries = useMemo(() => {
        return entries.filter(e => {
            if (e.companyId !== activeCompany?.id) return false;
            if (e.trashedAt) return false;
            return isDateInFilter(e.date);
        });
    }, [entries, activeCompany?.id, filterMode, selectedMonth, selectedYear]);

    const companyInvoices = useMemo(() => {
        return invoices.filter(i => {
            if (i.companyId !== activeCompany?.id) return false;
            if (i.trashedAt) return false;
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

    // Helpers to robustly identify category types even if they are renamed or recreated
    const isCategoryCMV = (categoryId: string) => {
        if (categoryId === 'cat-exp-3') return true;
        const cat = categories.find(c => c.id === categoryId);
        if (!cat) return false;
        const name = cat.name.toLowerCase();
        return name.includes('fornecedor') || name.includes('mercadoria') || name.includes('cmv') || name.includes('custo');
    };

    const isCategoryTax = (categoryId: string) => {
        if (categoryId === 'cat-exp-2') return true;
        const cat = categories.find(c => c.id === categoryId);
        if (!cat) return false;
        const name = cat.name.toLowerCase();
        return name.includes('imposto') || name.includes('tributo') || name.includes('taxa') || name.includes('das') || name.includes('irpj') || name.includes('csll');
    };

    const isCategoryFixed = (categoryId: string) => {
        if (categoryId === 'cat-exp-1') return true; // Folha de Pagamento geralmente é fixa
        const cat = categories.find(c => c.id === categoryId);
        if (!cat) return false;
        const name = cat.name.toLowerCase();
        return name.includes('salário') || name.includes('aluguel') || name.includes('fixa') || name.includes('software') || name.includes('contador') || name.includes('folha');
    };

    // CMV: Cost of Goods Sold / Suppliers
    const cmvExpenses = companyEntries
        .filter(e => e.type === 'expense' && e.status === 'paid' && isCategoryCMV(e.categoryId))
        .reduce((acc, curr) => acc + curr.amount, 0);

    const grossProfit = totalRevenue - cmvExpenses;
    const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

    // Operating Expenses (excluding CMV and Taxes)
    const operatingExpenses = companyEntries
        .filter(e => e.type === 'expense' && e.status === 'paid' && !isCategoryTax(e.categoryId) && !isCategoryCMV(e.categoryId))
        .reduce((acc, curr) => acc + curr.amount, 0);

    // EBIT (Lucro Operacional)
    const operatingProfit = grossProfit - operatingExpenses;
    const operatingMargin = totalRevenue > 0 ? ((operatingProfit / totalRevenue) * 100).toFixed(1) : 0;

    // Taxes
    const taxesPaid = companyEntries
        .filter(e => e.type === 'expense' && e.status === 'paid' && isCategoryTax(e.categoryId))
        .reduce((acc, curr) => acc + curr.amount, 0);

    // Net Income
    const netIncome = operatingProfit - taxesPaid;
    const netMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : 0;

    // Global company entries (for balances that should ignore period filters like A Pagar / A Receber)
    const globalCompanyEntries = entries.filter(e => e.companyId === activeCompany?.id && !e.trashedAt);

    // Pending (Global Balances)
    const pendingRevenue = globalCompanyEntries
        .filter(e => e.type === 'revenue' && e.status === 'pending')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const pendingExpense = globalCompanyEntries
        .filter(e => e.type === 'expense' && e.status === 'pending')
        .reduce((acc, curr) => acc + curr.amount, 0);

    // Cash Flow Forecast metrics (next 30 days independent of time filter, but filtered by company)
    const upcomingRevenue = entries
        .filter(e => e.companyId === activeCompany?.id && !e.trashedAt && e.type === 'revenue' && e.status === 'pending' && e.date && new Date(e.date) <= new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000))
        .reduce((acc, curr) => acc + curr.amount, 0);

    const upcomingExpense = entries
        .filter(e => e.companyId === activeCompany?.id && !e.trashedAt && e.type === 'expense' && e.status === 'pending' && e.date && new Date(e.date) <= new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000))
        .reduce((acc, curr) => acc + curr.amount, 0);

    const projectedCashflow = upcomingRevenue - upcomingExpense;

    // Chart Data Preparation - Historic Evolution
    const chartDataMap = new Map<string, {
        name: string; fullDate: Date; Receitas: number; Despesas: number; Saldo: number;
        ReceitasGeral: number; DespesasGeral: number;
        ReceitasAcumuladas: number; DespesasAcumuladas: number;
        ReceitasPagasAcumuladas: number; DespesasPagasAcumuladas: number;
    }>();

    // Group by month if filterMode is year or all, otherwise by day
    const groupByMonth = filterMode === 'specific_year' || filterMode === 'all';

    const safeDateObject = (dateParam: any) => {
        if (!dateParam) return new Date();
        const str = typeof dateParam === 'string' ? dateParam : new Date(dateParam).toISOString();
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return new Date(dateParam);
        const [, y, m, d] = match;
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0); // pad midday
    };

    companyEntries.filter(e => e.status === 'paid').forEach(entry => {
        const date = safeDateObject(entry.date);
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
            chartDataMap.set(dateKeyStr, {
                name: displayStr, fullDate: date, Receitas: 0, Despesas: 0, Saldo: 0,
                ReceitasGeral: 0, DespesasGeral: 0, ReceitasAcumuladas: 0, DespesasAcumuladas: 0,
                ReceitasPagasAcumuladas: 0, DespesasPagasAcumuladas: 0
            });
        }

        const current = chartDataMap.get(dateKeyStr)!;
        if (entry.type === 'revenue' && entry.status === 'paid') current.Receitas += entry.amount;
        if (entry.type === 'expense' && entry.status === 'paid') current.Despesas += entry.amount;

        // Break-even data
        if (entry.type === 'revenue') current.ReceitasGeral += entry.amount;
        if (entry.type === 'expense') current.DespesasGeral += entry.amount;
    });

    // Sort chronologically
    const chartData = Array.from(chartDataMap.values())
        .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime())
        .map(d => {
            d.Saldo = d.Receitas - d.Despesas;
            return d;
        });

    let cumulativeRevenues = 0;
    let cumulativeExpenses = 0;
    let cumulativeRevenuesPaid = 0;
    let cumulativeExpensesPaid = 0;

    chartData.forEach(d => {
        cumulativeRevenues += d.ReceitasGeral;
        cumulativeExpenses += d.DespesasGeral;
        cumulativeRevenuesPaid += d.Receitas;
        cumulativeExpensesPaid += d.Despesas;

        d.ReceitasAcumuladas = cumulativeRevenues;
        d.DespesasAcumuladas = cumulativeExpenses;
        d.ReceitasPagasAcumuladas = cumulativeRevenuesPaid;
        d.DespesasPagasAcumuladas = cumulativeExpensesPaid;
    });

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

    const inadimplencia = globalCompanyEntries.filter(e => e.type === 'revenue' && e.status === 'pending' && e.date && new Date(e.date) < new Date(new Date().setHours(0, 0, 0, 0))).reduce((acc, curr) => acc + curr.amount, 0);

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

    // --- 5 New Dashboard Charts Data Prep ---

    // 1. Receita por Entidade (Top 5)
    // Map using documentEntity (we already have entityRevenueMap from previous metrics if we want to reuse, but let's build exactly as we planned)
    const entityRevenueMapForChart = new Map<string, number>();
    companyEntries.filter(e => e.type === 'revenue' && e.status === 'paid').forEach(e => {
        const entity = e.documentEntity || 'Desconhecido/Avulso';
        entityRevenueMapForChart.set(entity, (entityRevenueMapForChart.get(entity) || 0) + e.amount);
    });
    const rawEntityData = Array.from(entityRevenueMapForChart.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    const top5Entities = rawEntityData.slice(0, 5);
    const othersEntityValue = rawEntityData.slice(5).reduce((acc, curr) => acc + curr.value, 0);
    if (othersEntityValue > 0) top5Entities.push({ name: 'Outros', value: othersEntityValue });
    const pieColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

    // 2. Despesas por Categoria (Top 5)
    const expenseChartData = Array.from(expenseMap.entries())
        .map(([id, value]) => ({ name: categories.find(c => c.id === id)?.name || 'Sem Categoria', value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    // X. Despesas Fixas vs Variáveis
    let fixedExpensesValue = 0;
    let variableExpensesValue = 0;
    companyEntries.filter(e => e.type === 'expense' && e.status === 'paid').forEach(e => {
        if (isCategoryFixed(e.categoryId)) {
            fixedExpensesValue += e.amount;
        } else {
            variableExpensesValue += e.amount;
        }
    });
    const fixedVsVariableData = [
        { name: 'Despesas Fixas', value: fixedExpensesValue, fill: '#3b82f6' },
        { name: 'Desp. Variáveis', value: variableExpensesValue, fill: '#f59e0b' }
    ].filter(d => d.value > 0);

    // 3. Status de Recebíveis (Barra Empilhada)
    const revStatusMap = new Map<string, { name: string; fullDate: Date; Pago: number; Pendente: number }>();
    companyEntries.filter(e => e.type === 'revenue').forEach(entry => {
        const date = safeDateObject(entry.date);
        let dateKeyStr = '';
        let displayStr = '';
        if (groupByMonth) {
            dateKeyStr = `${date.getFullYear()}-${date.getMonth()}`;
            displayStr = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        } else {
            dateKeyStr = date.toISOString().split('T')[0];
            displayStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }
        if (!revStatusMap.has(dateKeyStr)) revStatusMap.set(dateKeyStr, { name: displayStr, fullDate: date, Pago: 0, Pendente: 0 });
        const curr = revStatusMap.get(dateKeyStr)!;
        if (entry.status === 'paid') curr.Pago += entry.amount;
        if (entry.status === 'pending') curr.Pendente += entry.amount;
    });

    const revStatusData = Array.from(revStatusMap.values())
        .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime())
        .map(({ name, Pago, Pendente }) => ({ name, Pago, Pendente }));

    // 4. Inadimplência por Idade
    let atrasoRecente = 0; // < 15 dias
    let atrasoMedio = 0; // 15 - 30 dias
    let atrasoGrave = 0; // 30 - 60 dias
    let atrasoCritico = 0; // > 60 dias
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    globalCompanyEntries.filter(e => e.type === 'revenue' && e.status === 'pending' && e.date && new Date(e.date) < now).forEach(e => {
        const dueDate = new Date(e.date);
        dueDate.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(now.getTime() - dueDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 15) atrasoRecente += e.amount;
        else if (diffDays <= 30) atrasoMedio += e.amount;
        else if (diffDays <= 60) atrasoGrave += e.amount;
        else atrasoCritico += e.amount;
    });
    const agingData = [
        { name: '< 15 dias', valor: atrasoRecente, fill: '#facc15' },
        { name: '15-30 dias', valor: atrasoMedio, fill: '#f59e0b' },
        { name: '30-60 dias', valor: atrasoGrave, fill: '#ea580c' },
        { name: '> 60 dias', valor: atrasoCritico, fill: '#dc2626' }
    ];

    // 5. Evolução da Margem
    const marginChartData = chartData.map(d => {
        const mRevenue = d.Receitas;
        const mOperatingProfit = mRevenue - d.Despesas;
        const mMargin = mRevenue > 0 ? ((mOperatingProfit / mRevenue) * 100).toFixed(1) : 0;
        return { name: d.name, Margem: Number(mMargin) };
    });

    // --- NEW: 10 Advanced Governance Metrics for Licitações ---
    // 1. Concentração de Receita (Maior Pagador)
    let maiorPagadorKey = 'N/A';
    let maiorPagadorValor = 0;
    entityRevenueMapForChart.forEach((val, key) => {
        if (val > maiorPagadorValor) {
            maiorPagadorValor = val;
            maiorPagadorKey = key;
        }
    });
    const concentracaoMaiorPagadorPercent = totalRevenue > 0 ? ((maiorPagadorValor / totalRevenue) * 100).toFixed(1) : "0";

    // 2. Prazo Médio de Recebimento (PMR) Est.
    const vendasDiarias = totalRevenue > 0 ? totalRevenue / 30 : 0;
    const pmr = vendasDiarias > 0 ? (pendingRevenue / vendasDiarias).toFixed(0) : "0";

    // 3. Garantias Retidas / Caução (Estimativa 5% do faturamento histórico se for licitação)
    const garantiasEstimadas = totalHistoricalRevenue * 0.05;

    // 4. Despesas com Licitação (Plataformas, Certidões) proxy
    const despesasLicitacao = companyEntries
        .filter(e => e.type === 'expense' && e.status === 'paid' &&
            (e.title.toLowerCase().includes('licita') ||
                e.title.toLowerCase().includes('certidã') ||
                e.title.toLowerCase().includes('edital') ||
                e.title.toLowerCase().includes('plataforma')))
        .reduce((acc, curr) => acc + curr.amount, 0);

    // 5. Índice de Liquidez Corrente
    const disponibilidades = (saldoAtualGlobal > 0 ? saldoAtualGlobal : 0);
    const ativoCirculante = disponibilidades + pendingRevenue;
    const passivoCirculante = pendingExpense + upcomingExpense;
    const liquidezCorrente = passivoCirculante > 0 ? (ativoCirculante / passivoCirculante).toFixed(2) : (ativoCirculante > 0 ? "> 5.0" : "0.00");

    // 6. Eficácia de Faturamento
    const totalFaturadoReal = totalRevenue + pendingRevenue;
    const eficaciaFaturamento = totalFaturadoReal > 0 ? ((totalRevenue / totalFaturadoReal) * 100).toFixed(1) : "0";

    // 7. Custo de Aquisição de Acervo (ARTs, CREA) proxy
    const custosAcervo = companyEntries
        .filter(e => e.type === 'expense' && e.status === 'paid' &&
            (e.title.toLowerCase().includes('art') ||
                e.title.toLowerCase().includes('crea') ||
                e.title.toLowerCase().includes('cau') ||
                e.title.toLowerCase().includes('acervo') ||
                e.title.toLowerCase().includes('atestado')))
        .reduce((acc, curr) => acc + curr.amount, 0);

    // 8. Carga Tributária Efetiva
    const cargaTributaria = totalRevenue > 0 ? ((taxesPaid / totalRevenue) * 100).toFixed(1) : "0";

    // 9. Resultado Financeiro Líquido
    const rendimentos = companyEntries.filter(e => e.type === 'revenue' && e.status === 'paid' && e.title.toLowerCase().includes('rendimento')).reduce((acc, curr) => acc + curr.amount, 0);
    const despesasBancarias = companyEntries.filter(e => e.type === 'expense' && e.status === 'paid' && (e.title.toLowerCase().includes('tarifa') || e.title.toLowerCase().includes('taxa banc'))).reduce((acc, curr) => acc + curr.amount, 0);
    const resultadoFinanceiroLiquido = rendimentos - despesasBancarias;

    let runwayText = "Indefinido";
    if (operatingExpenses > 0) {
        const months = saldoAtualGlobal / operatingExpenses;
        runwayText = months > 0 ? `${months.toFixed(1)} Meses` : "Atenção (Critico)";
    } else if (saldoAtualGlobal > 0) {
        runwayText = "+12 Meses"
    }

    // --- NEW: 4 Advanced Governance Metrics (Requested) ---
    // 1. AR (Contas a Receber)
    const contasAReceberAR = pendingRevenue;

    // 2. EBITDA (Proxy Lucro antes de Juros, Impostos, Depreciação e Amortização - Usando Lucro Operacional como base simples)
    const ebitda = operatingProfit; // Assuming 'operatingProfit' already excluded taxes, interest, and no depreciation is recorded yet
    const ebitdaMargin = totalRevenue > 0 ? ((ebitda / totalRevenue) * 100).toFixed(1) : "0";

    // 3. MRR (Receita Recorrente Mensal)
    // Para simplificar: Soma das receitas vinculadas a contratos recorrentes. (Proxy: Receitas onde "notas" tem a palavra 'recorrente' ou 'mensalidade')
    const mrr = companyEntries
        .filter(e => e.type === 'revenue' && e.status === 'paid' &&
            (e.title.toLowerCase().includes('recorrente') || e.title.toLowerCase().includes('mensalidade') || e.notes?.toLowerCase().includes('recorrente')))
        .reduce((acc, curr) => acc + curr.amount, 0);

    // 4. Cash Burn (Taxa de Queima de Caixa)
    // Mede fluxo de caixa operacional negativo. Se for positivo, a queima é 0 (está gerando caixa).
    const cashBurn = operatingProfit < 0 ? Math.abs(operatingProfit) : 0;
    const runwayMeses = cashBurn > 0 ? (saldoAtualGlobal / cashBurn).toFixed(1) : "> 12";

    return (
        <div className="flex-1 bg-background text-foreground overflow-hidden flex flex-col">
            <div className="kanban-header h-12 flex items-center px-4 shrink-0 border-b border-border z-10">
                <h1 className="font-bold text-lg text-white">CONTÁBIL</h1>
                {activeCompany && (
                    <span className="ml-4 px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-medium border border-accent/30">
                        {activeCompany.nomeFantasia || activeCompany.razaoSocial}
                    </span>
                )}
                <div className="ml-auto">
                    <button
                        onClick={() => setTrashViewerOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-background/20 hover:bg-rose-500/20 text-white hover:text-rose-400 rounded-md transition-colors text-sm font-medium border border-transparent hover:border-rose-500/30"
                    >
                        <Trash2 className="h-4 w-4" /> Lixeira
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-6">
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                        <TabsList className="mb-6 bg-muted/40 border border-border p-1 w-full flex flex-wrap gap-1 h-auto justify-start overflow-x-auto hide-scrollbar">
                            <TabsTrigger value="dashboard" className="data-[state=active]:bg-background">Visão Geral (DRE)</TabsTrigger>
                            <TabsTrigger value="notas" className="data-[state=active]:bg-background">Logística NF (XML)</TabsTrigger>
                            <TabsTrigger value="banco" className="data-[state=active]:bg-background">Conciliação Bancária</TabsTrigger>
                            <TabsTrigger value="cobrancas" className="data-[state=active]:bg-background">Automações & Cobranças</TabsTrigger>
                            <TabsTrigger value="impostos" className="data-[state=active]:bg-background">Inteligência Tributária</TabsTrigger>
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
                                        className="bg-background text-foreground text-sm border-none rounded-md focus:ring-1 focus:ring-primary cursor-pointer font-medium px-2 py-1"
                                    >
                                        <option className="bg-background text-foreground" value="current_month">Mês Atual</option>
                                        <option className="bg-background text-foreground" value="specific_month">Mês Específico</option>
                                        <option className="bg-background text-foreground" value="specific_year">Ano Específico</option>
                                        <option className="bg-background text-foreground" value="all">Todo o Período</option>
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

                            {/* --- Advanced KPI Grid --- */}
                            <div className="mt-8 mb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                                    <BarChart3 className="h-5 w-5 text-primary" />
                                    Métricas Avançadas de Governança
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <BarChart3 className="h-4 w-4 text-emerald-500" />
                                            <h3 className="text-sm font-medium">Ticket Médio (Vendas)</h3>
                                        </div>
                                        <div className="text-xl font-bold">R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Por recebimento pago no período</p>
                                    </div>

                                    {/* --- 4 New Metrics --- */}
                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <Wallet className="h-4 w-4 text-emerald-500" />
                                            <h3 className="text-sm font-medium">AR (Contas a Receber)</h3>
                                        </div>
                                        <div className="text-xl font-bold text-emerald-500">R$ {contasAReceberAR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Receitas pendentes (data base)</p>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                                            <h3 className="text-sm font-medium">EBITDA Gerencial</h3>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <div className="text-xl font-bold text-emerald-400">R$ {ebitda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                            <span className="text-xs font-semibold text-emerald-400/80">({ebitdaMargin}%)</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Lucro Operacional antes de IR/CSLL</p>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group bg-indigo-500/5">
                                        <div className="flex items-center gap-2 mb-2 text-indigo-500">
                                            <Activity className="h-4 w-4" />
                                            <h3 className="text-sm font-medium">MRR Estimado</h3>
                                        </div>
                                        <div className="text-xl font-bold text-indigo-500">R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-[10px] text-indigo-500/70 font-medium mt-1">Receita Recorrente Mensal</p>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group bg-rose-500/5">
                                        <div className="flex items-center gap-2 mb-2 text-rose-500">
                                            <TrendingDown className="h-4 w-4" />
                                            <h3 className="text-sm font-medium">Cash Burn (Queima)</h3>
                                        </div>
                                        <div className="text-xl font-bold text-rose-500">R$ {cashBurn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-[10px] text-rose-500/70 font-medium mt-1">Déficit op. mensal (runway: {runwayMeses})</p>
                                    </div>
                                    {/* --- End New Metrics --- */}

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

                                    {/* Line 2 (Remaining 5) */}
                                    <div className={`kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group transition-all duration-300 ${Number(concentracaoMaiorPagadorPercent) > 50 ? 'ring-2 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : ''}`}>
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <Percent className="h-4 w-4 text-blue-500" />
                                            <h3 className="text-sm font-medium">Concentração Cliente</h3>
                                        </div>
                                        <div className="text-xl font-bold">{concentracaoMaiorPagadorPercent}%</div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Menor = Mais seguro</p>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <Clock className="h-4 w-4 text-amber-400" />
                                            <h3 className="text-sm font-medium">PMR Estimado</h3>
                                        </div>
                                        <div className="text-xl font-bold">{pmr} Dias</div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Prazo Médio Recebimento</p>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <Gavel className="h-4 w-4 text-orange-500" />
                                            <h3 className="text-sm font-medium">Custo Licitações</h3>
                                        </div>
                                        <div className="text-xl font-bold text-orange-500">R$ {despesasLicitacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Plataformas, Editais, Cauções</p>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <Award className="h-4 w-4 text-emerald-400" />
                                            <h3 className="text-sm font-medium">Acervo Técnico</h3>
                                        </div>
                                        <div className="text-xl font-bold text-emerald-400">R$ {custosAcervo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Atestados, CREA/CAU, Docs</p>
                                    </div>

                                    <div className={`kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group transition-all duration-300 ${Number(liquidezCorrente.replace('>', '').trim()) < 1.0 ? 'ring-2 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : ''}`}>
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <ShieldCheck className="h-4 w-4 text-teal-500" />
                                            <h3 className="text-sm font-medium">Índice de Liquidez Corrente</h3>
                                        </div>
                                        <div className="text-xl font-bold text-teal-500">{liquidezCorrente}</div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Capacidade de pagar Curto Prazo</p>
                                    </div>

                                    <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                            <Landmark className="h-4 w-4 text-blue-400" />
                                            <h3 className="text-sm font-medium">Resultado Financeiro L.</h3>
                                        </div>
                                        <div className={`text-xl font-bold ${resultadoFinanceiroLiquido >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                                            R$ {resultadoFinanceiroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Rendimentos vs Tarifas</p>
                                    </div>

                                    <div className={`kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between group bg-emerald-500/5 transition-all duration-300 ${runwayText.includes('Critico') ? 'ring-2 ring-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : ''}`}>
                                        <div className={`flex items-center gap-2 mb-2 ${runwayText.includes('Critico') ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            <Clock className="h-4 w-4" />
                                            <h3 className="text-sm font-medium">Runway (Fôlego)</h3>
                                        </div>
                                        <div className={`text-xl font-bold ${runwayText.includes('Critico') ? 'text-rose-500' : 'text-emerald-500'}`}>{runwayText}</div>
                                        <p className={`text-[10px] font-medium mt-1 ${runwayText.includes('Critico') ? 'text-rose-500/70' : 'text-emerald-500/70'}`}>Sobrevivência x custo fixo</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="kanban-card rounded-xl border border-border shadow-sm p-4">
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

                                <div className="kanban-card rounded-xl border border-border shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <ArrowLeftRight className="h-4 w-4 text-emerald-500" />
                                            Entradas vs Saídas Realizadas
                                        </h3>
                                    </div>
                                    <div className="h-72 w-full pt-4">
                                        {chartData.length === 0 ? (
                                            <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                                                <span className="text-muted-foreground text-sm">O histórico de movimentação não possui dados suficientes.</span>
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`} />
                                                    <Tooltip
                                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                        contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
                                                        itemStyle={{ fontWeight: 'bold' }}
                                                        formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                                    <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                    <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 5 New Advanced Visualizations Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                                {/* Chart 1: Concentração por Órgão */}
                                <div className="kanban-card rounded-xl border border-border shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <PieChartIcon className="h-4 w-4 text-purple-500" />
                                            Receita por Órgão Pagador
                                        </h3>
                                    </div>
                                    <div className="h-64 w-full">
                                        {top5Entities.length === 0 ? (
                                            <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                                                <span className="text-muted-foreground text-sm">Sem dados de receita pagos no período.</span>
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={top5Entities} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                        {top5Entities.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px', color: '#fff' }} />
                                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>

                                {/* Chart 2: Custos por Categoria */}
                                <div className="kanban-card rounded-xl border border-border shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <Building className="h-4 w-4 text-rose-500" />
                                            Top 5 Despesas por Categoria
                                        </h3>
                                    </div>
                                    <div className="h-64 w-full">
                                        {expenseChartData.length === 0 ? (
                                            <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                                                <span className="text-muted-foreground text-sm">Sem despesas pagas no período.</span>
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={expenseChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                                                    <XAxis type="number" stroke="#888" fontSize={10} tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} />
                                                    <YAxis dataKey="name" type="category" stroke="#888" fontSize={11} width={100} tickLine={false} axisLine={false} />
                                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px', color: '#fff' }} />
                                                    <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} maxBarSize={30} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>

                                {/* Chart 3: Eficácia do Recebimento (Stacked) */}
                                <div className="kanban-card rounded-xl border border-border shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <Target className="h-4 w-4 text-blue-400" />
                                            Status de Faturamentos
                                        </h3>
                                    </div>
                                    <div className="h-64 w-full">
                                        {revStatusData.length === 0 ? (
                                            <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                                                <span className="text-muted-foreground text-sm">Sem receitas faturadas no período.</span>
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={revStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`} />
                                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px', color: '#fff' }} />
                                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                                    <Bar dataKey="Pago" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} maxBarSize={40} />
                                                    <Bar dataKey="Pendente" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>

                                {/* Chart 4: Inadimplência por Idade (Aging) */}
                                <div className="kanban-card rounded-xl border border-border shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <CalendarClock className="h-4 w-4 text-orange-500" />
                                            Atrasos de Pagamento (Aging Público)
                                        </h3>
                                    </div>
                                    <div className="h-64 w-full">
                                        {(atrasoRecente + atrasoMedio + atrasoGrave + atrasoCritico) === 0 ? (
                                            <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                                                <span className="text-muted-foreground text-sm">Sem atrasos no momento. Saúde financeira ótima!</span>
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={agingData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px', color: '#fff' }} />
                                                    <Bar dataKey="valor" maxBarSize={60}>
                                                        {agingData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>

                                {/* Chart 6: Despesas Fixas vs Variáveis */}
                                <div className="kanban-card rounded-xl border border-border shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <PieChartIcon className="h-4 w-4 text-blue-500" />
                                            Despesas Fixas vs Variáveis
                                        </h3>
                                    </div>
                                    <div className="h-64 w-full">
                                        {fixedVsVariableData.length === 0 ? (
                                            <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                                                <span className="text-muted-foreground text-sm">Sem dados de despesa no período.</span>
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={fixedVsVariableData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                                                        {fixedVsVariableData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px', color: '#fff' }} />
                                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>

                                {/* Chart 7: Curva do Ponto de Equilíbrio */}
                                <div className="kanban-card rounded-xl border border-border shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <LineChartIcon className="h-4 w-4 text-emerald-500" />
                                            Curva do Ponto de Equilíbrio
                                        </h3>
                                    </div>
                                    <div className="h-64 w-full">
                                        {chartData.length === 0 ? (
                                            <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                                                <span className="text-muted-foreground text-sm">Sem dados para projetar o Break-even.</span>
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} />
                                                    <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px', color: '#fff' }} />
                                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                                    <Line type="monotone" name="Receitas (Acumuladas)" dataKey="ReceitasAcumuladas" stroke="#10b981" strokeWidth={3} dot={false} />
                                                    <Line type="monotone" name="Despesas (Acumuladas)" dataKey="DespesasAcumuladas" stroke="#f43f5e" strokeWidth={3} dot={false} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>

                                {/* Chart 5: Evolução da Margem de Contribuição */}
                                <div className="kanban-card rounded-xl border border-border lg:col-span-2 shadow-sm p-4 mb-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <LineChartIcon className="h-4 w-4 text-indigo-400" />
                                            Evolução Histórica da Margem
                                        </h3>
                                    </div>
                                    <div className="h-64 w-full">
                                        {marginChartData.length === 0 ? (
                                            <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                                                <span className="text-muted-foreground text-sm">Faltam dados históricos para traçar a margem.</span>
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={marginChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                                                    <Tooltip formatter={(value: number) => `${value}%`} contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px', color: '#fff' }} />
                                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                                    <Line type="stepAfter" dataKey="Margem" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        )}
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

                        <TabsContent value="exportacao" className="space-y-6">
                            <AccountantExportPanel />
                        </TabsContent>

                        <TabsContent value="prolabore" className="space-y-6">
                            <ProLaboreDash />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <AccountingTrashViewer
                open={trashViewerOpen}
                onOpenChange={setTrashViewerOpen}
            />
        </div>
    );
};

export default AccountingDashboard;
