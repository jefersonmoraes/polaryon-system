import { useState, useMemo } from 'react';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { CreditCard, TrendingUp, TrendingDown, DollarSign, Wallet, ArrowRight, Filter, Settings, Calculator, Activity } from 'lucide-react';

export const CashflowForecastDash = () => {
    const { entries, bankAccounts, updateBankAccount } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find(c => c.isDefault) || mainCompanies[0];

    const [forecastDays, setForecastDays] = useState<number>(30); // Dias à frente

    // Bank accounts for this company
    const companyBanks = bankAccounts.filter(b => b.companyId === activeCompany?.id);
    const visibleBanks = companyBanks.filter(b => !b.isHidden);

    const toggleBankVisibility = (id: string, isHidden: boolean) => {
        updateBankAccount(id, { isHidden: !isHidden });
    };

    // Total actual balance
    const currentActualBalance = visibleBanks.reduce((sum, bank) => sum + bank.balance, 0);

    // Calculate future revenues and expenses within the forecast window
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const futureDate = new Date(now.getTime() + forecastDays * 24 * 60 * 60 * 1000);

    const companyPendingEntries = entries.filter(e => e.companyId === activeCompany?.id && e.status === 'pending');

    let futureRevenue = 0;
    let futureExpense = 0;

    companyPendingEntries.forEach(entry => {
        if (!entry.date) return;
        const entryDate = new Date(entry.date);
        if (entryDate >= now && entryDate <= futureDate) {
            if (entry.type === 'revenue') futureRevenue += entry.amount;
            if (entry.type === 'expense') futureExpense += entry.amount;
        }
    });

    const projectedBalance = currentActualBalance + futureRevenue - futureExpense;

    return (
        <div className="flex-1 bg-background text-foreground overflow-hidden flex flex-col">
            <div className="kanban-header h-12 flex items-center px-4 shrink-0 border-b border-border z-10">
                <h1 className="font-bold text-lg text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-500" />
                    SIMULADOR DE FLUXO DE CAIXA
                </h1>
                {activeCompany && (
                    <span className="ml-4 px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-medium border border-accent/30">
                        {activeCompany.nomeFantasia || activeCompany.razaoSocial}
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* Simulation Controls */}
                    <div className="kanban-card p-6 rounded-xl border border-border bg-card shadow-lg">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Calculator className="h-5 w-5 text-primary" />
                                    Cenário Futuro
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1">Previsão baseada nas contas a pagar e receber futuras</p>
                            </div>

                            <div className="w-full md:w-96 p-4 bg-background border border-border rounded-xl">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium">Dias de Projeção</span>
                                    <span className="text-lg font-bold text-primary">{forecastDays} dias</span>
                                </div>
                                <input
                                    type="range"
                                    min="7"
                                    max="360"
                                    step="1"
                                    value={forecastDays}
                                    onChange={(e) => setForecastDays(Number(e.target.value))}
                                    className="w-full accent-primary"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
                                    <span>7d</span>
                                    <span>3M</span>
                                    <span>6M</span>
                                    <span>1 Ano</span>
                                </div>
                            </div>
                        </div>

                        {/* Projection Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-background border border-border p-4 rounded-xl flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                                    <Wallet className="h-4 w-4" />
                                    <span className="text-xs font-semibold uppercase">Saldo Atual (Bancos Visíveis)</span>
                                </div>
                                <span className={`text-2xl font-bold ${currentActualBalance >= 0 ? 'text-white' : 'text-rose-500'}`}>
                                    R$ {currentActualBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-1 text-emerald-500">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="text-xs font-semibold uppercase">A Receber (+ {forecastDays}d)</span>
                                </div>
                                <span className="text-2xl font-bold text-emerald-500">
                                    + R$ {futureRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-1 text-rose-500">
                                    <TrendingDown className="h-4 w-4" />
                                    <span className="text-xs font-semibold uppercase">A Pagar (+ {forecastDays}d)</span>
                                </div>
                                <span className="text-2xl font-bold text-rose-500">
                                    - R$ {futureExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className={`p-4 rounded-xl border flex flex-col justify-center transition-all duration-300 ${projectedBalance >= 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-rose-500/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)]'}`}>
                                <div className={`flex items-center gap-2 mb-1 ${projectedBalance >= 0 ? 'text-blue-400' : 'text-rose-500'}`}>
                                    <DollarSign className="h-4 w-4" />
                                    <span className="text-xs font-semibold uppercase">Saldo Previsto</span>
                                </div>
                                <span className={`text-3xl font-bold ${projectedBalance >= 0 ? 'text-blue-400' : 'text-rose-500'}`}>
                                    R$ {projectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Gestão de Contas Bancárias */}
                        <div className="kanban-card p-6 rounded-xl border border-border">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-blue-400" />
                                    Contas Bancárias
                                </h3>
                                <button className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                                    <Settings className="h-3 w-3" /> Gerenciar
                                </button>
                            </div>

                            <div className="space-y-3">
                                {companyBanks.length === 0 ? (
                                    <div className="text-center p-6 border border-dashed border-border rounded-lg text-muted-foreground text-sm flex flex-col items-center gap-2">
                                        <Wallet className="h-8 w-8 opacity-20" />
                                        Nenhuma conta bancária cadastrada.
                                    </div>
                                ) : (
                                    companyBanks.map(bank => (
                                        <div key={bank.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${bank.isHidden ? 'bg-muted/10 border-border/40 opacity-50' : 'bg-background border-border hover:border-blue-500/30'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 border border-border" style={{ backgroundColor: bank.color ? `${bank.color}20` : undefined, borderColor: bank.color }}>
                                                    <CreditCard className="h-4 w-4" style={{ color: bank.color || '#fff' }} />
                                                </div>
                                                <div>
                                                    <p className={`font-medium text-sm ${bank.isHidden ? 'line-through decoration-muted-foreground/50' : ''}`}>{bank.name}</p>
                                                    <p className="text-xs text-muted-foreground">Saldo Real</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`font-bold ${bank.balance < 0 ? 'text-rose-500' : 'text-foreground'}`}>
                                                    R$ {bank.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <button
                                                    onClick={() => toggleBankVisibility(bank.id, !!bank.isHidden)}
                                                    className={`text-xs px-2 py-1 rounded transition-colors ${bank.isHidden ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                                                >
                                                    {bank.isHidden ? 'Incluir' : 'Ocultar'}
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Impacto das Contas no Cenário */}
                        <div className="kanban-card p-6 rounded-xl border border-border">
                            <h3 className="font-bold flex items-center gap-2 mb-6 text-muted-foreground">
                                <ArrowRight className="h-5 w-5" />
                                Simulação por Conta
                            </h3>
                            <div className="text-sm text-muted-foreground mb-4">
                                Mostrando impacto futuro nas contas ativas (rateio proporcional simulado):
                            </div>
                            <div className="space-y-3">
                                {visibleBanks.map(bank => {
                                    // Simulação básica: Distribui a projeção proporcionalmente ao saldo atual de cada conta
                                    // ou divide igualmente se totais forem zeros.
                                    const percentShare = currentActualBalance > 0 ? (bank.balance / currentActualBalance) : (1 / visibleBanks.length);
                                    const bankProjectedImpact = (futureRevenue - futureExpense) * percentShare;
                                    const bankProjectedBalance = bank.balance + bankProjectedImpact;

                                    return (
                                        <div key={bank.id} className="flex flex-col gap-1 p-3 rounded-lg bg-background border border-border">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="font-medium">{bank.name}</span>
                                                <span className={`font-bold ${bankProjectedBalance >= 0 ? 'text-blue-400' : 'text-rose-500'}`}>
                                                    R$ {bankProjectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex">
                                                <div
                                                    className={`h-full ${bankProjectedBalance >= 0 ? 'bg-blue-500' : 'bg-rose-500'}`}
                                                    style={{ width: `${Math.min(100, Math.max(0, (bankProjectedBalance / (currentActualBalance + Math.abs(projectedBalance) || 1)) * 100))}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {visibleBanks.length === 0 && (
                                    <div className="text-center p-4 text-xs">Ative pelo menos uma conta para ver o impacto projetado.</div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div >
    );
};
