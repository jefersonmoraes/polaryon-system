import React from 'react';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';

export const PdfDreReport = React.forwardRef<HTMLDivElement, { activeCompany: any }>(({ activeCompany }, ref) => {
    const { entries } = useAccountingStore();

    // Quick calculations for the DRE report
    const companyEntries = entries.filter(e => e.companyId === activeCompany?.id && !e.trashedAt);
    const revenue = companyEntries.filter(e => e.type === 'revenue' && e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
    const expenses = companyEntries.filter(e => e.type === 'expense' && e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
    const profit = revenue - expenses;
    const taxes = companyEntries.filter(e => e.type === 'expense' && e.categoryId?.includes('tax') && e.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div
            ref={ref}
            className="bg-white text-slate-800 p-10 flex flex-col w-[800px] h-[1131px] overflow-hidden"
            style={{ fontFamily: 'Inter, sans-serif' }}
        >
            <div className="flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 uppercase">Demonstração do Resultado do Exercício (DRE)</h1>
                    <p className="text-sm text-slate-500 mt-1">Período Consolidado</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-slate-800">{activeCompany?.nomeFantasia || activeCompany?.razaoSocial}</p>
                    <p className="text-xs text-slate-600">CNPJ: {activeCompany?.cnpj}</p>
                    <p className="text-xs text-slate-500 mt-1">Gerado em: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</p>
                </div>
            </div>

            <main className="flex-1">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr>
                            <th className="pe-4 py-2 text-left text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">Descrição e Classificação</th>
                            <th className="pe-4 py-2 w-32 text-right text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">Valor (R$)</th>
                            <th className="py-2 w-24 text-right text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">Análise V.</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="pe-4 py-3 border-b border-slate-100 font-bold text-slate-800">1. RECEITA OPERACIONAL BRUTA</td>
                            <td className="pe-4 py-3 border-b border-slate-100 text-right font-bold text-emerald-600">{revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td className="py-3 border-b border-slate-100 text-right text-slate-500">100.0%</td>
                        </tr>
                        <tr>
                            <td className="pe-4 py-3 pl-6 border-b border-slate-100 text-slate-600">(-) Deduções e Impostos S/ Vendas</td>
                            <td className="pe-4 py-3 border-b border-slate-100 text-right text-rose-600">({taxes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</td>
                            <td className="py-3 border-b border-slate-100 text-right text-slate-400">{revenue > 0 ? ((taxes / revenue) * 100).toFixed(1) : '0.0'}%</td>
                        </tr>
                        <tr className="bg-slate-50">
                            <td className="pe-4 py-3 border-b border-slate-200 font-bold text-slate-800">2. RECEITA OPERACIONAL LÍQUIDA</td>
                            <td className="pe-4 py-3 border-b border-slate-200 text-right font-bold text-slate-800">{(revenue - taxes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td className="py-3 border-b border-slate-200 text-right font-medium text-slate-500">{revenue > 0 ? (((revenue - taxes) / revenue) * 100).toFixed(1) : '0.0'}%</td>
                        </tr>
                        <tr>
                            <td className="pe-4 py-3 pl-6 border-b border-slate-100 text-slate-600">(-) Custos e Despesas Variáveis</td>
                            <td className="pe-4 py-3 border-b border-slate-100 text-right text-rose-600">({(expenses - taxes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</td>
                            <td className="py-3 border-b border-slate-100 text-right text-slate-400">{revenue > 0 ? (((expenses - taxes) / revenue) * 100).toFixed(1) : '0.0'}%</td>
                        </tr>
                        <tr className="bg-slate-100 border-t border-b border-slate-300">
                            <td className="pe-4 py-4 font-black text-slate-900 uppercase">3. RESULTADO DO EXERCÍCIO (LÍQUIDO)</td>
                            <td className={`pe-4 py-4 text-right font-black ${profit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td className="py-4 text-right font-bold text-slate-600">{revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0'}%</td>
                        </tr>
                    </tbody>
                </table>
                <div className="mt-8 text-sm text-slate-500 leading-relaxed border p-4 rounded-lg bg-orange-50 border-orange-100">
                    <p className="font-semibold text-orange-800 mb-1">Nota Explicativa:</p>
                    Este Demonstrativo do Resultado do Exercício (DRE) foi consolidado com base nos registros mantidos pelo sistema Flowtask Pro até a presente data.
                    Recomenda-se a revisão criteriosa de todas as entradas pela contabilidade, antes da submissão a órgãos governamentais.
                </div>
            </main>

            <footer className="mt-8 text-center border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500 font-medium">FLOWTASK PRO - MÓDULO CONTÁBIL</p>
            </footer>
        </div>
    );
});

export default PdfDreReport;
