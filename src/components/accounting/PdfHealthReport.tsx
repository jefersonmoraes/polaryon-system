import React from 'react';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';

export const PdfHealthReport = React.forwardRef<HTMLDivElement, { activeCompany: any }>(({ activeCompany }, ref) => {
    const { entries } = useAccountingStore();

    // Quick calculations for the health report
    const companyEntries = entries.filter(e => e.companyId === activeCompany?.id && !e.trashedAt);
    const revenue = companyEntries.filter(e => e.type === 'revenue' && e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
    const expenses = companyEntries.filter(e => e.type === 'expense' && e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
    const profit = revenue - expenses;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    const generateRecommendation = (margin: number) => {
        if (margin < 0) return "⚠️ CRÍTICO: A empresa está operando com prejuízo. Priorize redução imediata de custos ou captação financeira urgente.";
        if (margin < 15) return "⚠️ ATENÇÃO: Margem de lucro baixa. Considere rever precificação e cortar despesas operacionais supérfluas.";
        if (margin < 30) return "✅ SAUDÁVEL: Operação equilibrada, busque otimizar processos para maximizar resultados futuros.";
        return "🌟 EXCELENTE: Alta rentabilidade. Oportunidade para reinvestir no negócio em P&D ou Expansão.";
    };

    return (
        <div
            ref={ref}
            className="bg-white text-slate-800 p-8 flex flex-col w-[800px] h-[1131px] overflow-hidden"
            style={{ fontFamily: 'Inter, sans-serif' }}
        >
            <div className="flex justify-between items-end border-b-2 border-slate-200 pb-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">RELATÓRIO DE SAÚDE FINANCEIRA</h1>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-1">Análise Gerencial Automatizada</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-slate-800">{activeCompany?.nomeFantasia || activeCompany?.razaoSocial}</p>
                    <p className="text-xs text-slate-500">CNPJ: {activeCompany?.cnpj}</p>
                    <p className="text-xs text-slate-500 mt-2">Emitido em: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</p>
                </div>
            </div>

            <main className="flex-1 flex flex-col">
                <section className="mb-8">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 border-l-4 border-primary pl-3">Visão Geral do Exercício</h2>
                    <div className="grid grid-cols-3 gap-6">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex flex-col justify-center">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Receita Total</p>
                            <p className="text-2xl font-black text-emerald-600">R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex flex-col justify-center">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Custo Total</p>
                            <p className="text-2xl font-black text-rose-600">R$ {expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex flex-col justify-center">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Lucro Operacional</p>
                            <p className={`text-2xl font-black ${profit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 border-l-4 border-blue-500 pl-3">Indicadores Chave</h2>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm">
                            <h3 className="text-sm font-semibold opacity-70 mb-2">Margem de Lucratividade</h3>
                            <div className="flex items-end gap-3">
                                <span className={`text-4xl font-black ${margin >= 15 ? 'text-emerald-400' : margin > 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                    {margin.toFixed(1)}%
                                </span>
                                <span className="text-xs opacity-70 mb-1">da receita líquida</span>
                            </div>
                        </div>
                        <div className="bg-slate-100 text-slate-800 rounded-xl p-6 border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Ponto de Atenção</h3>
                            <p className="text-sm font-medium leading-relaxed">
                                {generateRecommendation(margin)}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="mb-8 flex-1">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 border-l-4 border-purple-500 pl-3">Gráfico de Proporção (Dados Consolidados)</h2>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 flex items-center justify-center flex-1">
                        <div className="flex w-full max-w-lg items-center gap-8">
                            <div className="relative w-40 h-40 rounded-full border-[16px] border-emerald-500 flex items-center justify-center" style={{ borderRightColor: margin > 0 ? '#10b981' : '#f43f5e', borderTopColor: '#f43f5e' }}>
                                <span className="text-xs font-bold text-slate-800">C/R</span>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded bg-emerald-500"></div>
                                    <span className="text-sm font-semibold text-slate-700">Entradas / Ativos</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded bg-rose-500"></div>
                                    <span className="text-sm font-semibold text-slate-700">Saídas / Custos Fixos</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-4 max-w-[200px]">
                                    (Representação gráfica ilustrativa da volumetria transacional baseada nas entradas consolidadas do sistema)
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

            </main>

            <footer className="mt-8 pt-4 border-t border-slate-200 text-center">
                <p className="text-[10px] text-slate-400 italic">Documento gerado automaticamente pelo Polaryon System. Uso exclusivo gerencial. Não substitui demonstrações contábeis oficiais.</p>
            </footer>
        </div>
    );
});

export default PdfHealthReport;
