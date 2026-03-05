import { useState, useEffect } from 'react';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { ArrowUpRight, ArrowDownRight, DollarSign, Activity, FileText, AlertCircle, TrendingUp, Clock, Receipt } from 'lucide-react';
import { AccountantExportPanel } from '@/components/accounting/AccountantExportPanel';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InvoiceManager } from '@/components/accounting/InvoiceManager';
import { XmlImporter } from '@/components/accounting/XmlImporter';
import { BankReconciliation } from '@/components/accounting/BankReconciliation';
import { CobrancasPanel } from '@/components/accounting/CobrancasPanel';
import { TaxDash } from '@/components/accounting/TaxDash';

const AccountingDashboard = () => {
    const { entries, invoices } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    // Filtrar pela empresa ativa
    const companyEntries = entries.filter(e => e.companyId === activeCompany?.id);
    const companyInvoices = invoices.filter(i => i.companyId === activeCompany?.id);

    // Invoice Metrics
    const totalInvoicesValue = companyInvoices.reduce((acc, curr) => acc + curr.amount, 0);
    const totalInvoicesCount = companyInvoices.length;

    const totalRevenue = companyEntries
        .filter(e => e.type === 'revenue' && e.status === 'paid')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const totalExpense = companyEntries
        .filter(e => e.type === 'expense' && e.status === 'paid')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const pendingRevenue = companyEntries
        .filter(e => e.type === 'revenue' && e.status === 'pending')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const pendingExpense = companyEntries
        .filter(e => e.type === 'expense' && e.status === 'pending')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const netIncome = totalRevenue - totalExpense;
    const profitMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : 0;

    // Chart Data Preparation
    const chartDataMap = new Map<string, { name: string; Receitas: number; Despesas: number }>();
    companyEntries.forEach(entry => {
        const dateStr = new Date(entry.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!chartDataMap.has(dateStr)) {
            chartDataMap.set(dateStr, { name: dateStr, Receitas: 0, Despesas: 0 });
        }
        const current = chartDataMap.get(dateStr)!;
        if (entry.type === 'revenue' && entry.status === 'paid') current.Receitas += entry.amount;
        if (entry.type === 'expense' && entry.status === 'paid') current.Despesas += entry.amount;
    });
    const chartData = Array.from(chartDataMap.values()).reverse().slice(-7).reverse();

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
                        <TabsList className="mb-6 bg-muted/40 border border-border p-1 w-full flex flex-wrap h-auto justify-start">
                            <TabsTrigger value="dashboard" className="data-[state=active]:bg-background">Visão Geral</TabsTrigger>
                            <TabsTrigger value="notas" className="data-[state=active]:bg-background">Logística NF (XML)</TabsTrigger>
                            <TabsTrigger value="banco" className="data-[state=active]:bg-background">Conciliação Bancária</TabsTrigger>
                            <TabsTrigger value="cobrancas" className="data-[state=active]:bg-background">Automações & Cobranças</TabsTrigger>
                            <TabsTrigger value="impostos" className="data-[state=active]:bg-background">Tributos & Saúde</TabsTrigger>
                        </TabsList>

                        <TabsContent value="dashboard" className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">Resumo Financeiro</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all"></div>
                                    <div className="flex items-center justify-between pb-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">Notas Emitidas</h3>
                                        <div className="p-2 bg-blue-500/10 rounded-lg">
                                            <Receipt className="h-4 w-4 text-blue-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-foreground">R$ {totalInvoicesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <div className="flex items-center gap-1 mt-1">
                                            <FileText className="h-3 w-3 text-blue-500/70" />
                                            <p className="text-[10px] text-blue-500/70 font-medium">{totalInvoicesCount} {totalInvoicesCount === 1 ? 'nota gerada' : 'notas geradas'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
                                    <div className="flex items-center justify-between pb-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">Receitas (Pagas)</h3>
                                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                                            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <div className="flex items-center gap-1 mt-1">
                                            <Clock className="h-3 w-3 text-emerald-500/70" />
                                            <p className="text-[10px] text-emerald-500/70 font-medium">+{pendingRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendente</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all"></div>
                                    <div className="flex items-center justify-between pb-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">Despesas (Pagas)</h3>
                                        <div className="p-2 bg-rose-500/10 rounded-lg">
                                            <ArrowDownRight className="h-4 w-4 text-rose-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <div className="flex items-center gap-1 mt-1">
                                            <AlertCircle className="h-3 w-3 text-rose-500/70" />
                                            <p className="text-[10px] text-rose-500/70 font-medium">-{pendingExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendente</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
                                    <div className="flex items-center justify-between pb-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">Margem de Lucro</h3>
                                        <div className="p-2 bg-amber-500/10 rounded-lg">
                                            <TrendingUp className="h-4 w-4 text-amber-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-amber-500">{profitMargin}%</div>
                                        <p className="text-xs text-muted-foreground mt-1">Eficiência Operacional</p>
                                    </div>
                                </div>

                                <div className="kanban-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all"></div>
                                    <div className="flex items-center justify-between pb-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">Resultado Líquido</h3>
                                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                                            <DollarSign className="h-4 w-4 text-indigo-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            R$ {netIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Lucro ou Prejuízo Real</p>
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
                                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`} />
                                                    <Tooltip
                                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                        contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
                                                        itemStyle={{ fontWeight: 'bold' }}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                                    <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                    <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                </BarChart>
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
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

export default AccountingDashboard;
