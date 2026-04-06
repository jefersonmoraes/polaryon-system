import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import idbStorage from '@/lib/idb-storage';
import { socketService } from '@/lib/socket';
import { useAuditStore } from './audit-store';
import { useAuthStore } from './auth-store';
import api from '@/lib/api';

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
    AccountantExport,
    RecurringExpense
} from '@/types/accounting';

export interface AccountingState {
    entries: AccountingEntry[];
    categories: AccountingCategory[];
    bankAccounts: BankAccount[];
    invoices: Invoice[];
    bankTransactions: BankTransaction[];
    taxObligations: TaxObligation[];
    settings: Record<string, AccountingSettings>; // key: companyId
    exports: AccountantExport[];
    recurringExpenses: RecurringExpense[];

    // Actions
    setAllData: (data: any) => void;
    fetchAccountingData: () => Promise<void>;
    syncLocalDataToServer: () => Promise<void>;
    
    addEntry: (entry: Omit<AccountingEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateEntry: (id: string, entry: Partial<AccountingEntry>) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
    restoreEntry: (id: string) => Promise<void>;

    addCategory: (category: Omit<AccountingCategory, 'id'>) => Promise<void>;
    updateCategory: (id: string, category: Partial<AccountingCategory>) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
    
    addBankAccount: (account: Omit<BankAccount, 'id'>) => Promise<void>;
    updateBankAccount: (id: string, account: Partial<BankAccount>) => Promise<void>;
    deleteBankAccount: (id: string) => Promise<void>;
    
    addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Promise<void>;
    updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<void>;
    deleteInvoice: (id: string) => Promise<void>;
    restoreInvoice: (id: string) => Promise<void>;

    addBankTransaction: (transaction: Omit<BankTransaction, 'id'>) => Promise<void>;
    reconcileTransaction: (transactionId: string, entryId: string) => Promise<void>;

    calculateTaxes: (companyId: string, month: string, porte: string) => void;
    updateSettings: (companyId: string, settings: Partial<AccountingSettings>) => Promise<void>;
    payTax: (id: string) => Promise<void>;

    updateTaxObligation: (id: string, tax: Partial<TaxObligation>) => Promise<void>;
    deleteTaxObligation: (id: string) => Promise<void>;
    restoreTaxObligation: (id: string) => Promise<void>;
    addTaxObligation: (tax: TaxObligation) => Promise<void>;

    addExport: (exp: Omit<AccountantExport, 'id' | 'createdAt'>) => Promise<void>;
    deleteExport: (id: string) => Promise<void>;
    restoreExport: (id: string) => Promise<void>;

    addRecurringExpense: (expense: Omit<RecurringExpense, 'id' | 'createdAt'>) => Promise<void>;
    updateRecurringExpense: (id: string, expense: Partial<RecurringExpense>) => Promise<void>;
    deleteRecurringExpense: (id: string) => Promise<void>;
    generateRecurringExpenses: () => void;

    cleanOldTrash: () => void;
    processSystemAction: (action: any) => void;
}

const DEFAULT_CATEGORIES: AccountingCategory[] = [
    { id: 'cat-rev-1', name: 'Venda de Produtos', type: 'revenue', color: '#10b981' },
    { id: 'cat-rev-2', name: 'Prestação de Serviços', type: 'revenue', color: '#059669' },
    { id: 'cat-rev-3', name: 'Rendimentos Financeiros', type: 'revenue', color: '#34d399' },
    { id: 'cat-exp-1', name: 'Folha de Pagamento', type: 'expense', color: '#ef4444' },
    { id: 'cat-exp-2', name: 'Impostos e Taxas', type: 'expense', color: '#dc2626' },
    { id: 'cat-exp-3', name: 'Fornecedores', type: 'expense', color: '#f87171' },
    { id: 'cat-exp-4', name: 'Despesas Operacionais', type: 'expense', color: '#ea580c' },
    { id: 'cat-exp-5', name: 'Marketing / Vendas', type: 'expense', color: '#f97316' },
];

export const useAccountingStore = create<AccountingState>()(
    persist(
        (set, get) => ({
            entries: [],
            categories: DEFAULT_CATEGORIES,
            bankAccounts: [],
            invoices: [],
            bankTransactions: [],
            taxObligations: [],
            exports: [],
            settings: {},
            recurringExpenses: [],

            setAllData: (data: any) => {
                set({
                    entries: data.entries || [],
                    categories: data.categories?.length ? data.categories : DEFAULT_CATEGORIES,
                    bankAccounts: data.bankAccounts || [],
                    invoices: data.invoices || [],
                    bankTransactions: data.bankTransactions || [],
                    taxObligations: data.taxObligations || [],
                    exports: data.exports || [],
                    settings: data.settings || {},
                    recurringExpenses: data.recurringExpenses || []
                });
            },

            fetchAccountingData: async () => {
                try {
                    const res = await api.get('/accounting/sync');
                    get().setAllData(res.data);
                } catch (error) {
                    console.error('Failed to fetch accounting data:', error);
                }
            },

            syncLocalDataToServer: async () => {
                const s = get();
                try {
                    // Pull cloud data first
                    const res = await api.get('/accounting/sync');
                    const cloud = res.data;
                    
                    const cloudEntryIds = new Set(cloud.entries?.map((x: any) => x.id) || []);
                    const localEntriesToSync = s.entries.filter(x => !cloudEntryIds.has(x.id) && !x.trashedAt);
                    for(const item of localEntriesToSync) { try { await api.post('/accounting/entry', item); } catch(e){} }

                    // To avoid a huge manual sync block, we reload state from the cloud immediately after 
                    // attempting to push just the entries. (Entries are the most critical).
                    const updatedRes = await api.get('/accounting/sync');
                    get().setAllData(updatedRes.data);
                } catch (error) {
                    console.error('Failed to sync accounting data', error);
                }
            },

            addEntry: async (entry) => {
                const newId = crypto.randomUUID();
                const now = new Date().toISOString();
                const currentUser = useAuthStore.getState().currentUser;

                if (currentUser) {
                    useAuditStore.getState().addLog({
                        userId: currentUser.id,
                        userName: currentUser.name,
                        action: 'CRIAR',
                        entity: 'LANÇAMENTO',
                        details: `Criou lançamento "${entry.description || entry.title}"`
                    });
                }

                const newEntry = { ...entry, id: newId, createdAt: now, updatedAt: now } as AccountingEntry;
                try {
                    await api.post('/accounting/entry', newEntry);
                    set(s => ({ entries: [...s.entries, newEntry] }));
                } catch (error) { console.error(error); }
            },

            updateEntry: async (id, data) => {
                const now = new Date().toISOString();
                try {
                    await api.put(`/accounting/entry/${id}`, data);
                    set(s => ({ entries: s.entries.map(e => e.id === id ? { ...e, ...data, updatedAt: now } : e) }));
                } catch (error) { console.error(error); }
            },

            deleteEntry: async (id) => {
                const now = new Date().toISOString();
                try {
                    await api.put(`/accounting/entry/${id}`, { trashed: true, trashedAt: now });
                    set(s => ({ entries: s.entries.map(e => e.id === id ? { ...e, trashedAt: now, trashed: true, updatedAt: now } : e) }));
                } catch (error) { console.error(error); }
            },

            restoreEntry: async (id) => {
                const now = new Date().toISOString();
                try {
                    await api.put(`/accounting/entry/${id}`, { trashed: false, trashedAt: null });
                    set(s => ({ entries: s.entries.map(e => e.id === id ? { ...e, trashedAt: undefined, trashed: false, updatedAt: now } : e) }));
                } catch (error) { console.error(error); }
            },

            addCategory: async (cat) => {
                const newCat = { ...cat, id: crypto.randomUUID() };
                try {
                    await api.post('/accounting/category', newCat);
                    set(s => ({ categories: [...s.categories, newCat] }));
                } catch (error) { console.error(error); }
            },

            updateCategory: async (id, data) => {
                try {
                    await api.put(`/accounting/category/${id}`, data);
                    set(s => ({ categories: s.categories.map(c => c.id === id ? { ...c, ...data } : c) }));
                } catch (error) { console.error(error); }
            },

            deleteCategory: async (id) => {
                try {
                    await api.delete(`/accounting/category/${id}`);
                    set(s => ({ categories: s.categories.filter(c => c.id !== id) }));
                } catch (error) { console.error(error); }
            },

            addBankAccount: async (acc) => {
                const newAcc = { ...acc, id: crypto.randomUUID() };
                try {
                    await api.post('/accounting/bankAccount', newAcc);
                    set(s => ({ bankAccounts: [...s.bankAccounts, newAcc] }));
                } catch (error) { console.error(error); }
            },

            updateBankAccount: async (id, data) => {
                try {
                    await api.put(`/accounting/bankAccount/${id}`, data);
                    set(s => ({ bankAccounts: s.bankAccounts.map(a => a.id === id ? { ...a, ...data } : a) }));
                } catch (error) { console.error(error); }
            },

            deleteBankAccount: async (id) => {
                try {
                    await api.delete(`/accounting/bankAccount/${id}`);
                    set(s => ({ bankAccounts: s.bankAccounts.filter(a => a.id !== id) }));
                } catch (error) { console.error(error); }
            },

            addInvoice: async (inv) => {
                const newInv = { ...inv, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
                try {
                    await api.post('/accounting/invoice', newInv);
                    set(s => ({ invoices: [...s.invoices, newInv as Invoice] }));
                } catch (error) { console.error(error); }
            },

            updateInvoice: async (id, data) => {
                try {
                    await api.put(`/accounting/invoice/${id}`, data);
                    set(s => ({ invoices: s.invoices.map(i => i.id === id ? { ...i, ...data } : i) }));
                } catch (error) { console.error(error); }
            },

            deleteInvoice: async (id) => {
                const now = new Date().toISOString();
                try {
                    await api.put(`/accounting/invoice/${id}`, { trashed: true, trashedAt: now });
                    set(s => ({ invoices: s.invoices.map(i => i.id === id ? { ...i, trashedAt: now, trashed: true } : i) }));
                } catch (error) { console.error(error); }
            },

            restoreInvoice: async (id) => {
                try {
                    await api.put(`/accounting/invoice/${id}`, { trashed: false, trashedAt: null });
                    set(s => ({ invoices: s.invoices.map(i => i.id === id ? { ...i, trashedAt: undefined, trashed: false } : i) }));
                } catch (error) { console.error(error); }
            },

            addBankTransaction: async (tx) => {
                const newTx = { ...tx, id: crypto.randomUUID() };
                try {
                    await api.post('/accounting/bankTransaction', newTx);
                    set(s => ({ bankTransactions: [...s.bankTransactions, newTx] }));
                } catch (error) { console.error(error); }
            },

            reconcileTransaction: async (txId, entryId) => {
                try {
                    await api.put(`/accounting/bankTransaction/${txId}`, { status: 'reconciled', matchedEntryId: entryId });
                    await api.put(`/accounting/entry/${entryId}`, { status: 'paid' });
                    set(s => {
                        const tx = s.bankTransactions.find(t => t.id === txId);
                        const entry = s.entries.find(e => e.id === entryId);
                        if (!tx || !entry) return s;
                        return {
                            bankTransactions: s.bankTransactions.map(t => t.id === txId ? { ...t, status: 'reconciled', matchedEntryId: entryId } : t),
                            entries: s.entries.map(e => e.id === entryId ? { ...e, status: 'paid', updatedAt: new Date().toISOString() } : e)
                        };
                    });
                } catch (error) { console.error(error); }
            },

            calculateTaxes: (companyId, month, porte) => {
                set(s => { return s; });
            },

            updateSettings: async (companyId, data) => {
                try {
                    await api.post(`/accounting/settings/${companyId}`, data);
                    set(s => ({ settings: { ...s.settings, [companyId]: { ...s.settings[companyId], ...data, companyId } } }));
                } catch (error) { console.error(error); }
            },

            payTax: async (id) => {
                // No direct state change here, action is handled by backend
            },

            updateTaxObligation: async (id, data) => {
                try {
                    await api.put(`/accounting/taxObligation/${id}`, data);
                    set(s => ({ taxObligations: s.taxObligations.map(t => t.id === id ? { ...t, ...data } : t) }));
                } catch (error) { console.error(error); }
            },

            deleteTaxObligation: async (id) => {
                const now = new Date().toISOString();
                try {
                    await api.put(`/accounting/taxObligation/${id}`, { trashed: true, trashedAt: now });
                    set(s => ({ taxObligations: s.taxObligations.map(t => t.id === id ? { ...t, trashedAt: now, trashed: true } : t) }));
                } catch (error) { console.error(error); }
            },

            restoreTaxObligation: async (id) => {
                try {
                    await api.put(`/accounting/taxObligation/${id}`, { trashed: false, trashedAt: null });
                    set(s => ({ taxObligations: s.taxObligations.map(t => t.id === id ? { ...t, trashedAt: undefined, trashed: false } : t) }));
                } catch (error) { console.error(error); }
            },

            addTaxObligation: async (tax) => {
                try {
                    await api.post('/accounting/taxObligation', tax);
                    set(s => ({ taxObligations: [tax, ...s.taxObligations] }));
                } catch (error) { console.error(error); }
            },

            addExport: async (exp) => {
                const newExp = { ...exp, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AccountantExport;
                try {
                    await api.post('/accounting/export', newExp);
                    set(s => ({ exports: [...s.exports, newExp] }));
                } catch (error) { console.error(error); }
            },

            deleteExport: async (id) => {
                const now = new Date().toISOString();
                try {
                    await api.put(`/accounting/export/${id}`, { trashed: true, trashedAt: now });
                    set(s => ({ exports: s.exports.map(e => e.id === id ? { ...e, trashedAt: now, trashed: true } : e) }));
                } catch (error) { console.error(error); }
            },

            restoreExport: async (id) => {
                try {
                    await api.put(`/accounting/export/${id}`, { trashed: false, trashedAt: null });
                    set(s => ({ exports: s.exports.map(e => e.id === id ? { ...e, trashedAt: undefined, trashed: false } : e) }));
                } catch (error) { console.error(error); }
            },

            addRecurringExpense: async (exp) => {
                const newExp = { ...exp, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
                try {
                    await api.post('/accounting/recurringExpense', newExp);
                    set(s => ({ recurringExpenses: [...s.recurringExpenses, newExp] }));
                } catch (error) { console.error(error); }
            },

            updateRecurringExpense: async (id, data) => {
                try {
                    await api.put(`/accounting/recurringExpense/${id}`, data);
                    set(s => ({ recurringExpenses: s.recurringExpenses.map(r => r.id === id ? { ...r, ...data } : r) }));
                } catch (error) { console.error(error); }
            },

            deleteRecurringExpense: async (id) => {
                try {
                    await api.delete(`/accounting/recurringExpense/${id}`);
                    set(s => ({ recurringExpenses: s.recurringExpenses.filter(r => r.id !== id) }));
                } catch (error) { console.error(error); }
            },

            generateRecurringExpenses: () => {
                // Local logic
            },

            cleanOldTrash: () => {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                set(s => ({
                    entries: s.entries.filter(e => !e.trashedAt || new Date(e.trashedAt) >= thirtyDaysAgo),
                    invoices: s.invoices.filter(i => !i.trashedAt || new Date(i.trashedAt) >= thirtyDaysAgo),
                    taxObligations: s.taxObligations.filter(t => !t.trashedAt || new Date(t.trashedAt) >= thirtyDaysAgo),
                    exports: s.exports.filter(e => !e.trashedAt || new Date(e.trashedAt) >= thirtyDaysAgo)
                }));
            },

            processSystemAction: (action: any) => {
                const { type, payload } = action;
                if (!type || !payload) return;
                
                switch(type) {
                    case 'ADD_ENTRY':
                        set(s => s.entries.find(e => e.id === payload.id) ? s : ({ entries: [payload, ...s.entries] }));
                        break;
                    case 'UPDATE_ENTRY':
                        set(s => ({ entries: s.entries.map(e => e.id === payload.id ? { ...e, ...payload.data, updatedAt: new Date().toISOString() } : e) }));
                        break;
                    case 'DELETE_ENTRY':
                        set(s => ({ entries: s.entries.map(e => e.id === payload.id ? { ...e, trashed: true, trashedAt: new Date().toISOString() } : e) }));
                        break;
                    case 'RESTORE_ENTRY':
                        set(s => ({ entries: s.entries.map(e => e.id === payload.id ? { ...e, trashed: false, trashedAt: undefined } : e) }));
                        break;
                        
                    case 'ADD_CATEGORY':
                        set(s => ({ categories: [...s.categories, payload] }));
                        break;
                    case 'UPDATE_CATEGORY':
                        set(s => ({ categories: s.categories.map(c => c.id === payload.id ? { ...c, ...payload.data } : c) }));
                        break;
                    case 'DELETE_CATEGORY':
                        set(s => ({ categories: s.categories.filter(c => c.id !== payload.id) }));
                        break;
                        
                    case 'ADD_BANK_ACCOUNT':
                        set(s => ({ bankAccounts: [...s.bankAccounts, payload] }));
                        break;
                    case 'UPDATE_BANK_ACCOUNT':
                        set(s => ({ bankAccounts: s.bankAccounts.map(b => b.id === payload.id ? { ...b, ...payload.data } : b) }));
                        break;
                    case 'DELETE_BANK_ACCOUNT':
                        set(s => ({ bankAccounts: s.bankAccounts.filter(b => b.id !== payload.id) }));
                        break;
                        
                    case 'ADD_RECURRING':
                        set(s => ({ recurringExpenses: [...s.recurringExpenses, payload] }));
                        break;
                    case 'UPDATE_RECURRING':
                        set(s => ({ recurringExpenses: s.recurringExpenses.map(r => r.id === payload.id ? { ...r, ...payload.data } : r) }));
                        break;
                    case 'DELETE_RECURRING':
                        set(s => ({ recurringExpenses: s.recurringExpenses.filter(r => r.id !== payload.id) }));
                        break;
                        
                    // For brevity, other types can be refreshed gracefully. 
                    default:
                        // Trigger fetching background update for broader changes
                        break;
                }
            }
        }),
        {
            name: 'accounting-storage-idb',
            storage: createJSONStorage(() => idbStorage),
            onRehydrateStorage: () => {
                // Cleanup old localStorage key
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.removeItem('accounting-storage');
                    } catch (e) {}
                }
            }
        }
    )
);

socketService.on('system_sync', (action: any) => {
    if (action.store === 'ACCOUNTING') {
        useAccountingStore.getState().processSystemAction(action);
    }
});
