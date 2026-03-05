import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { Check, Columns, RefreshCw, Link2, X, Building2, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BANKS_AVAILABLE = [
    { id: 'itau', name: 'Itaú Unibanco', logoBg: 'bg-orange-500', logoText: 'text-white' },
    { id: 'bb', name: 'Banco do Brasil', logoBg: 'bg-yellow-400', logoText: 'text-blue-900' },
    { id: 'nubank', name: 'Nubank', logoBg: 'bg-purple-600', logoText: 'text-white' },
    { id: 'bradesco', name: 'Bradesco', logoBg: 'bg-red-600', logoText: 'text-white' },
    { id: 'santander', name: 'Santander', logoBg: 'bg-red-500', logoText: 'text-white' },
    { id: 'caixa', name: 'Caixa Econômica', logoBg: 'bg-blue-600', logoText: 'text-white' },
    { id: 'cora', name: 'Cora', logoBg: 'bg-pink-500', logoText: 'text-white' },
    { id: 'inter', name: 'Banco Inter', logoBg: 'bg-orange-500', logoText: 'text-white' },
];

export const BankReconciliation = () => {
    const { entries, bankTransactions, addBankTransaction, reconcileTransaction } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
    const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [connectingBank, setConnectingBank] = useState<string | null>(null);
    const [connectedBankState, setConnectedBankState] = useState<boolean>(false);

    const companyEntries = entries.filter(e => e.companyId === activeCompany?.id && e.status === 'pending');
    const pendingTransactions = bankTransactions.filter(t => t.companyId === activeCompany?.id && t.status === 'pending');

    const handleReconcile = () => {
        if (!selectedEntry || !selectedTransaction) return;
        reconcileTransaction(selectedTransaction, selectedEntry);
        toast.success("Lançamento conciliado com sucesso!");
        setSelectedEntry(null);
        setSelectedTransaction(null);
    };

    const simulateBankImport = () => {
        if (!activeCompany) return;
        // Simulate importing a bank statement line that matches a pending entry roughly
        if (companyEntries.length > 0) {
            const entryToMatch = companyEntries[0];
            addBankTransaction({
                companyId: activeCompany.id,
                date: new Date().toISOString(),
                description: `TRANSFERENCIA - ${entryToMatch.type === 'revenue' ? 'REC' : 'PAG'}`,
                amount: entryToMatch.amount,
                type: entryToMatch.type === 'revenue' ? 'credit' : 'debit',
                status: 'pending'
            });
            toast.success("Extrato bancário simulado importado.");
        } else {
            addBankTransaction({
                companyId: activeCompany.id,
                date: new Date().toISOString(),
                description: "TARIFA BANCARIA",
                amount: 45.90,
                type: 'debit',
                status: 'pending'
            });
            toast.success("Nova tarifa bancária identificada no extrato.");
        }
    };

    const handleConnectBank = (bankId: string) => {
        setConnectingBank(bankId);
        // Simulate Open Finance connection delay
        setTimeout(() => {
            setConnectingBank(null);
            setConnectedBankState(true);
            toast.success("Integração Open Finance preparada!");
        }, 2000);
    };

    return (
        <div className="kanban-card rounded-xl border border-border shadow-sm flex flex-col h-full min-h-[500px]">
            <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-bold flex items-center gap-2">
                    <Columns className="h-4 w-4 text-primary" />
                    Conciliação Bancária
                </h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors font-medium border ${connectedBankState ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'}`}
                    >
                        {connectedBankState ? <ShieldCheck className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                        {connectedBankState ? 'Banco Vinculado (API)' : 'Conectar Banco (Open Finance)'}
                    </button>
                    {!connectedBankState && (
                        <button
                            onClick={simulateBankImport}
                            className="text-xs bg-muted/50 hover:bg-muted text-foreground px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                        >
                            <RefreshCw className="h-3 w-3" />
                            Simular Extrato
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 grid grid-cols-2 divide-x divide-border relative">

                {/* Overlay explaining backend dependency if connected */}
                {connectedBankState && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center">
                        <div className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                            <ShieldCheck className="h-8 w-8 text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-2">Conexão Open Finance Ativa</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            A interface do <b>Open Finance</b> foi ativada com sucesso. Para que as transações reais apareçam aqui automaticamente (como via Pluggy ou TecnoSpeed), esta funcionalidade aguarda a implementação do Backend do sistema.
                        </p>
                        <button
                            onClick={() => setConnectedBankState(false)}
                            className="mt-6 text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                        >
                            Voltar para o modo de simulação manual
                        </button>
                    </div>
                )}


                {/* Extrato Bancário */}
                <div className="p-4 flex flex-col h-full">
                    <h4 className="text-sm font-medium text-muted-foreground mb-4">Extrato Bancário (Aberto)</h4>
                    <div className="flex-1 space-y-2 overflow-auto custom-scrollbar">
                        {pendingTransactions.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-8">Nenhuma transação bancária pendente.</p>
                        ) : (
                            pendingTransactions.map(tx => (
                                <div
                                    key={tx.id}
                                    onClick={() => setSelectedTransaction(selectedTransaction === tx.id ? null : tx.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedTransaction === tx.id
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border/50 bg-muted/20 hover:border-primary/50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-xs font-semibold">{tx.description}</p>
                                        <span className={`text-xs font-bold ${tx.type === 'credit' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {tx.type === 'credit' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">{new Date(tx.date).toLocaleDateString()}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Lançamentos do Sistema */}
                <div className="p-4 flex flex-col h-full">
                    <h4 className="text-sm font-medium text-muted-foreground mb-4">Lançamentos no ERP (Pendentes)</h4>
                    <div className="flex-1 space-y-2 overflow-auto custom-scrollbar">
                        {companyEntries.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-8">Nenhum lançamento pendente no sistema.</p>
                        ) : (
                            companyEntries.map(entry => (
                                <div
                                    key={entry.id}
                                    onClick={() => setSelectedEntry(selectedEntry === entry.id ? null : entry.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedEntry === entry.id
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border/50 bg-muted/20 hover:border-primary/50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="truncate pr-2">
                                            <p className="text-xs font-semibold truncate">{entry.title}</p>
                                            <p className="text-[10px] text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</p>
                                        </div>
                                        <span className={`text-xs font-bold shrink-0 ${entry.type === 'revenue' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Ação de Conciliar */}
            <div className="p-4 border-t border-border bg-muted/10 flex justify-between items-center z-20">
                <p className="text-xs text-muted-foreground">
                    Selecione uma transação do banco e um lançamento do ERP para conciliar.
                </p>
                <button
                    disabled={!selectedEntry || !selectedTransaction || connectedBankState}
                    onClick={handleReconcile}
                    className="bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors hover:bg-primary/90"
                >
                    <Check className="h-4 w-4" />
                    Conciliar Selecionados
                </button>
            </div>

            {/* OPEN FINANCE MODAL */}
            {isModalOpen && document.body ? createPortal(
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl border border-border w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                            <div>
                                <h3 className="font-bold flex items-center gap-2 text-foreground">
                                    <Link2 className="h-5 w-5 text-primary" />
                                    Conectar via Open Finance
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Acesse o extrato em tempo real do seu banco com segurança BCB.
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground bg-muted p-1.5 rounded-md transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5 flex-1 overflow-auto custom-scrollbar">
                            {!connectingBank && !connectedBankState && (
                                <>
                                    <div className="mb-4 flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-blue-600 dark:text-blue-400">
                                        <ShieldCheck className="h-5 w-5 shrink-0" />
                                        <p className="text-xs font-medium">Sua conexão é 100% segura, de leitura (read-only) e certificada pelo Banco Central.</p>
                                    </div>
                                    <h4 className="text-sm font-semibold mb-3">Selecione sua Instituição Financeira</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {BANKS_AVAILABLE.map(bank => (
                                            <button
                                                key={bank.id}
                                                onClick={() => handleConnectBank(bank.id)}
                                                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/10 hover:border-primary/50 hover:bg-muted/30 transition-all text-left group"
                                            >
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${bank.logoBg}`}>
                                                    <Building2 className={`h-4 w-4 ${bank.logoText}`} />
                                                </div>
                                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{bank.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {connectingBank && (
                                <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                                    <h3 className="font-bold text-lg mb-2">Redirecionando para o Banco...</h3>
                                    <p className="text-sm text-muted-foreground max-w-[280px]">
                                        Você precisará confirmar o acesso no aplicativo do {BANKS_AVAILABLE.find(b => b.id === connectingBank)?.name}.
                                    </p>
                                </div>
                            )}

                            {connectedBankState && !connectingBank && (
                                <div className="flex flex-col items-center justify-center py-8 text-center h-full">
                                    <div className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                                        <Check className="h-8 w-8 text-emerald-500" />
                                    </div>
                                    <h3 className="font-bold text-lg mb-2 text-foreground">Conta Vinculada!</h3>
                                    <p className="text-sm text-muted-foreground mb-6">
                                        A infraestrutura Open Finance foi configurada.
                                    </p>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
                                    >
                                        Concluir
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-border bg-muted/20 flex justify-center">
                            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 opacity-70">
                                Powered by Integração Open Finance Brasil
                            </span>
                        </div>
                    </div>
                </div>,
                document.body
            ) : null}
        </div>
    );
};
