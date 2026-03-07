import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuditStore } from './audit-store';
import { useAuthStore } from './auth-store';

import {
    EntryType,
    EntryStatus,
    AccountingCategory,
    BankAccount,
    AccountingEntry,
    Invoice,
    BankTransaction,
    TaxObligation,
    AccountingSettings,
    AccountantExport
} from '@/types/accounting';

export interface AccountingState {
    entries: AccountingEntry[];
    categories: AccountingCategory[];
    bankAccounts: BankAccount[];
    invoices: Invoice[];
    bankTransactions: BankTransaction[];
    taxObligations: TaxObligation[];
    settings: Record<string, AccountingSettings>; // key: companyId

    // Actions
    addEntry: (entry: Omit<AccountingEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateEntry: (id: string, entry: Partial<AccountingEntry>) => void;
    deleteEntry: (id: string) => void;
    restoreEntry: (id: string) => void;

    addCategory: (category: Omit<AccountingCategory, 'id'>) => void;
    updateCategory: (id: string, category: Partial<AccountingCategory>) => void;
    deleteCategory: (id: string) => void;
    // Bank Accounts
    addBankAccount: (account: Omit<BankAccount, 'id'>) => void;
    updateBankAccount: (id: string, account: Partial<BankAccount>) => void;
    deleteBankAccount: (id: string) => void;
    // Invoices
    addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => void;
    updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
    deleteInvoice: (id: string) => void;
    restoreInvoice: (id: string) => void;

    addBankTransaction: (transaction: Omit<BankTransaction, 'id'>) => void;
    reconcileTransaction: (transactionId: string, entryId: string) => void;

    calculateTaxes: (companyId: string, month: string, porte: string) => void;
    updateSettings: (companyId: string, settings: Partial<AccountingSettings>) => void;
    payTax: (id: string) => void;

    updateTaxObligation: (id: string, tax: Partial<TaxObligation>) => void;
    deleteTaxObligation: (id: string) => void;
    restoreTaxObligation: (id: string) => void;

    // Exports
    exports: AccountantExport[];
    addExport: (exp: Omit<AccountantExport, 'id' | 'createdAt'>) => void;
    deleteExport: (id: string) => void;
    restoreExport: (id: string) => void;

    cleanOldTrash: () => void;
}

const DEFAULT_CATEGORIES: AccountingCategory[] = [
    // Revenues
    { id: 'cat-rev-1', name: 'Venda de Produtos', type: 'revenue', color: '#10b981' },
    { id: 'cat-rev-2', name: 'Prestação de Serviços', type: 'revenue', color: '#059669' },
    { id: 'cat-rev-3', name: 'Rendimentos Financeiros', type: 'revenue', color: '#34d399' },
    // Expenses
    { id: 'cat-exp-1', name: 'Folha de Pagamento', type: 'expense', color: '#ef4444' },
    { id: 'cat-exp-2', name: 'Impostos e Taxas', type: 'expense', color: '#dc2626' },
    { id: 'cat-exp-3', name: 'Fornecedores', type: 'expense', color: '#f87171' },
    { id: 'cat-exp-4', name: 'Despesas Operacionais', type: 'expense', color: '#ea580c' },
    { id: 'cat-exp-5', name: 'Marketing / Vendas', type: 'expense', color: '#f97316' },
];

export const useAccountingStore = create<AccountingState>()(
    persist(
        (set) => ({
            entries: [],
            categories: DEFAULT_CATEGORIES,
            bankAccounts: [],
            invoices: [],
            bankTransactions: [],
            taxObligations: [],
            exports: [],
            settings: {},

            addEntry: (entry) => set((state) => {
                const newId = crypto.randomUUID();
                const currentUser = useAuthStore.getState().currentUser;

                if (currentUser) {
                    useAuditStore.getState().addLog({
                        userId: currentUser.id,
                        userName: currentUser.name,
                        action: 'CRIAR',
                        entity: 'LANÇAMENTO',
                        details: `Criou lançamento "${entry.description}" no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.amount)}`
                    });
                }

                return {
                    entries: [
                        ...state.entries,
                        {
                            ...entry,
                            id: newId,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        }
                    ]
                };
            }),

            updateEntry: (id, updatedEntry) => set((state) => {
                const currentUser = useAuthStore.getState().currentUser;
                const oldEntry = state.entries.find(e => e.id === id);

                if (currentUser && oldEntry) {
                    useAuditStore.getState().addLog({
                        userId: currentUser.id,
                        userName: currentUser.name,
                        action: 'EDITAR',
                        entity: 'LANÇAMENTO',
                        details: `Modificou dados do lançamento "${oldEntry.description}"`
                    });
                }

                return {
                    entries: state.entries.map((entry) => {
                        if (entry.id === id) {
                            const isTrashing = (updatedEntry as any).trashed === true && !(entry as any).trashed;
                            return {
                                ...entry,
                                ...updatedEntry,
                                updatedAt: new Date().toISOString(),
                                // If some manual edit sends it to trash or uses the generic update, catch it here just in case.
                                trashedAt: isTrashing ? new Date().toISOString() : ((updatedEntry as any).trashed === false ? undefined : entry.trashedAt)
                            };
                        }
                        return entry;
                    }),
                };
            }),

            deleteEntry: (id) => set((state) => {
                const currentUser = useAuthStore.getState().currentUser;
                const targetEntry = state.entries.find(e => e.id === id);

                if (currentUser && targetEntry) {
                    useAuditStore.getState().addLog({
                        userId: currentUser.id,
                        userName: currentUser.name,
                        action: 'EXCLUIR',
                        entity: 'LANÇAMENTO',
                        details: `Deletou o lançamento "${targetEntry.description}"`
                    });
                }

                // Soft Delete
                return {
                    entries: state.entries.map((entry) =>
                        entry.id === id ? { ...entry, trashedAt: new Date().toISOString() } : entry
                    )
                };
            }),

            restoreEntry: (id) =>
                set((state) => ({
                    entries: state.entries.map((entry) =>
                        entry.id === id ? { ...entry, trashedAt: undefined } : entry
                    )
                })),

            addCategory: (category) =>
                set((state) => ({
                    categories: [
                        ...state.categories,
                        { ...category, id: crypto.randomUUID() },
                    ],
                })),

            updateCategory: (id, updatedCategory) =>
                set((state) => ({
                    categories: state.categories.map((category) =>
                        category.id === id ? { ...category, ...updatedCategory } : category
                    ),
                })),

            deleteCategory: (id) =>
                set((state) => ({
                    categories: state.categories.filter((c) => c.id !== id),
                })),

            addBankAccount: (account) =>
                set((state) => ({
                    bankAccounts: [
                        ...state.bankAccounts,
                        { ...account, id: crypto.randomUUID() },
                    ],
                })),

            updateBankAccount: (id, updatedAccount) =>
                set((state) => ({
                    bankAccounts: state.bankAccounts.map((a) =>
                        a.id === id ? { ...a, ...updatedAccount } : a
                    ),
                })),

            deleteBankAccount: (id) =>
                set((state) => ({
                    bankAccounts: state.bankAccounts.filter((a) => a.id !== id),
                })),

            addInvoice: (invoice) =>
                set((state) => ({
                    invoices: [
                        ...state.invoices,
                        {
                            ...invoice,
                            id: crypto.randomUUID(),
                            createdAt: new Date().toISOString(),
                        } as Invoice
                    ]
                })),

            updateInvoice: (id, updatedInvoice) =>
                set((state) => ({
                    invoices: state.invoices.map((inv) => {
                        if (inv.id === id) {
                            const isTrashing = (updatedInvoice as any).trashed === true && !(inv as any).trashed;
                            return {
                                ...inv,
                                ...updatedInvoice,
                                trashedAt: isTrashing ? new Date().toISOString() : ((updatedInvoice as any).trashed === false ? undefined : inv.trashedAt)
                            };
                        }
                        return inv;
                    })
                })),

            deleteInvoice: (id) =>
                set((state) => ({
                    invoices: state.invoices.map((inv) => inv.id === id ? { ...inv, trashedAt: new Date().toISOString() } : inv),
                })),

            restoreInvoice: (id) =>
                set((state) => ({
                    invoices: state.invoices.map((inv) => inv.id === id ? { ...inv, trashedAt: undefined } : inv),
                })),

            addBankTransaction: (transaction) =>
                set((state) => ({
                    bankTransactions: [
                        ...state.bankTransactions,
                        {
                            ...transaction,
                            id: crypto.randomUUID()
                        }
                    ]
                })),

            reconcileTransaction: (transactionId, entryId) =>
                set((state) => {
                    const transaction = state.bankTransactions.find(t => t.id === transactionId);
                    const entry = state.entries.find(e => e.id === entryId);

                    if (!transaction || !entry) return state;

                    return {
                        bankTransactions: state.bankTransactions.map(t =>
                            t.id === transactionId ? { ...t, status: 'reconciled', matchedEntryId: entryId } : t
                        ),
                        entries: state.entries.map(e =>
                            e.id === entryId ? { ...e, status: 'paid', updatedAt: new Date().toISOString() } : e // Assume paid when reconciled
                        )
                    };
                }),

            calculateTaxes: (companyId, month, porte) =>
                set((state) => {
                    const settings = state.settings[companyId];
                    // Se não for MEI e não tiver config, não avança. MEI não precisa de config para DAS fixo.
                    if (!settings && porte !== 'MEI') return state;

                    // Calculate total taxable revenue for the month
                    const revenueForMonth = state.entries
                        .filter(e => e.companyId === companyId && e.type === 'revenue' && e.date.startsWith(month))
                        .reduce((sum, e) => sum + e.amount, 0);

                    let taxAmount = 0;
                    let taxName = 'Guia DAS';

                    if (porte === 'MEI') {
                        // Cálculo Automático do MEI (Baseado no Salário Mínimo do Ano)
                        const year = parseInt(month.split('-')[0]) || new Date().getFullYear();
                        // Tabela histórica / projeção de salários mínimos no Brasil
                        const minimumWages: Record<number, number> = {
                            2024: 1412.00,
                            2025: 1518.00,
                            2026: 1621.00, // Projeção oficial
                            2027: 1720.00
                        };
                        const baseWage = minimumWages[year] || minimumWages[2026];

                        // 5% de INSS sobre o salário mínimo
                        const inss = baseWage * 0.05;

                        // Acréscimos por atividade (ICMS / ISS)
                        let additionalTax = 0;
                        const activity = settings?.meiActivityType || 'service';
                        if (activity === 'commerce') additionalTax = 1.00; // ICMS
                        else if (activity === 'service') additionalTax = 5.00; // ISS
                        else if (activity === 'both') additionalTax = 6.00; // ICMS + ISS

                        taxAmount = inss + additionalTax;
                        taxName = 'Guia DAS (MEI)';
                    } else if (settings) {
                        taxAmount = revenueForMonth * (settings.taxRatePercentage / 100);
                        if (settings.taxRegime === 'lucro_presumido' || settings.taxRegime === 'lucro_real') {
                            taxName = 'Impostos Federais/Municipais';
                        }
                    }

                    // Check if obligation already exists for this month/company
                    const existingTaxIndex = state.taxObligations.findIndex(
                        t => t.companyId === companyId && t.month === month && (t.name === 'Guia DAS' || t.name === 'Guia DAS (MEI)' || t.name === 'Impostos Federais/Municipais')
                    );

                    const newObligations = [...state.taxObligations];

                    if (existingTaxIndex >= 0) {
                        if (taxAmount > 0) {
                            newObligations[existingTaxIndex] = {
                                ...newObligations[existingTaxIndex],
                                amount: taxAmount,
                                name: taxName
                            };
                        } else {
                            // se zerar, remove a obrigacao (a menos que seja MEI q nunca zera normalmente)
                            newObligations.splice(existingTaxIndex, 1);
                        }
                    } else if (taxAmount > 0) {
                        // Create due date for day 20 of next month
                        const [yyyy, mm] = month.split('-');
                        let nextMonth = parseInt(mm) + 1;
                        let year = parseInt(yyyy);
                        if (nextMonth > 12) {
                            nextMonth = 1;
                            year++;
                        }
                        const dueDate = `${year}-${nextMonth.toString().padStart(2, '0')}-20`;

                        newObligations.push({
                            id: crypto.randomUUID(),
                            companyId,
                            month,
                            name: taxName,
                            amount: taxAmount,
                            dueDate,
                            status: 'pending' as const
                        });
                    }

                    return { taxObligations: newObligations };
                }),

            updateSettings: (companyId, newSettings) =>
                set((state) => ({
                    settings: {
                        ...state.settings,
                        [companyId]: {
                            ...state.settings[companyId],
                            ...newSettings,
                            companyId
                        }
                    }
                })),

            updateTaxObligation: (id, updatedTax) =>
                set((state) => ({
                    taxObligations: state.taxObligations.map(t => {
                        if (t.id === id) {
                            const isTrashing = (updatedTax as any).trashed === true && !(t as any).trashed;
                            return {
                                ...t,
                                ...updatedTax,
                                trashedAt: isTrashing ? new Date().toISOString() : ((updatedTax as any).trashed === false ? undefined : t.trashedAt)
                            }
                        }
                        return t;
                    })
                })),

            deleteTaxObligation: (id) =>
                set((state) => ({
                    taxObligations: state.taxObligations.map(t => t.id === id ? { ...t, trashedAt: new Date().toISOString() } : t),
                })),

            restoreTaxObligation: (id) =>
                set((state) => ({
                    taxObligations: state.taxObligations.map(t => t.id === id ? { ...t, trashedAt: undefined } : t),
                })),

            payTax: (id) =>
                set((state) => {
                    const tax = state.taxObligations.find(t => t.id === id);
                    if (!tax) return state;

                    const updatedObligations = state.taxObligations.map(t =>
                        t.id === id ? { ...t, status: 'paid' as const, paymentDate: new Date().toISOString() } : t
                    );

                    const defaultTaxCategory = state.categories.find(c => c.id === 'cat-exp-2' || c.name.toLowerCase().includes('imposto') || c.name.toLowerCase().includes('tributo') || c.name.toLowerCase().includes('taxa')) || state.categories.find(c => c.type === 'expense');
                    const targetCategoryId = defaultTaxCategory ? defaultTaxCategory.id : 'cat-exp-2';

                    const taxExpense: AccountingEntry = {
                        id: crypto.randomUUID(),
                        companyId: tax.companyId,
                        title: `Pagamento ${tax.name} - Competência ${tax.month}`,
                        description: 'Imposto recolhido.',
                        amount: tax.amount,
                        date: new Date().toISOString(),
                        type: 'expense',
                        categoryId: targetCategoryId, // Smart fallback for Impostos e Taxas
                        status: 'paid',
                        documentEntity: 'Governo / Receita',
                        competenceDate: `${tax.month}-01T12:00:00.000Z`,
                        paymentMethod: 'bank_transfer',
                        linkedTaxId: tax.id,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };

                    return {
                        taxObligations: updatedObligations,
                        entries: [...state.entries, taxExpense]
                    };
                }),

            addExport: (exp) =>
                set((state) => ({
                    exports: [
                        ...state.exports,
                        { ...exp, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AccountantExport
                    ]
                })),

            deleteExport: (id) =>
                set((state) => ({
                    exports: state.exports.map(exp => exp.id === id ? { ...exp, trashedAt: new Date().toISOString() } : exp)
                })),

            restoreExport: (id) =>
                set((state) => ({
                    exports: state.exports.map(exp => exp.id === id ? { ...exp, trashedAt: undefined } : exp)
                })),

            cleanOldTrash: () => set(state => {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                return {
                    entries: state.entries.filter(e => !e.trashedAt || new Date(e.trashedAt) >= thirtyDaysAgo),
                    invoices: state.invoices.filter(i => !i.trashedAt || new Date(i.trashedAt) >= thirtyDaysAgo),
                    taxObligations: state.taxObligations.filter(t => !t.trashedAt || new Date(t.trashedAt) >= thirtyDaysAgo),
                    exports: state.exports.filter(exp => !exp.trashedAt || new Date(exp.trashedAt) >= thirtyDaysAgo)
                };
            })
        }),
        {
            name: 'accounting-storage',
        }
    )
);
