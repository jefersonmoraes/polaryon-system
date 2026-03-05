export type EntryType = 'revenue' | 'expense';
export type EntryStatus = 'pending' | 'paid' | 'overdue';

export interface AccountingCategory {
    id: string;
    name: string;
    type: EntryType;
    color: string;
}

export interface AccountingEntry {
    id: string;
    companyId: string; // Relacionado à 'Administradora'
    title: string;
    description?: string;
    amount: number;
    date: string; // ISO date string
    dueDate?: string; // Data de vencimento
    type: EntryType;
    categoryId: string;
    status: EntryStatus;
    documentNumber?: string; // Número da NF, Recibo ou Fatura
    documentEntity?: string; // Nome do Cliente / Fornecedor
    documentEntityId?: string; // CPF / CNPJ do Cliente / Fornecedor
    competenceDate?: string; // Data de Competência (Fato gerador)
    paymentMethod?: 'pix' | 'boleto' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'cash';
    notes?: string; // Observações para auditoria (Centro de custo, detalhes de contrato, etc)
    attachments?: string[]; // Array of file URLs/base64
    linkedTaxId?: string; // Relacionamento bidirecional com Inteligência Tributária
    linkedInvoiceId?: string; // Relacionamento bidirecional com NF Emitida
    createdAt: string;
    updatedAt: string;
}

// Novos Tipos para o ERP

export type InvoiceType = 'service' | 'product';
export type InvoiceStatus = 'draft' | 'issued' | 'cancelled';

export interface Invoice {
    id: string;
    companyId: string;
    number: string; // Número da NF
    issueDate: string;
    type: InvoiceType;
    clientName: string;
    clientDocument: string; // CPF/CNPJ
    amount: number;
    status: InvoiceStatus;
    caminho_danfe?: string;
    xmlData?: string; // Cache do XML se importado
    xmlUrl?: string; // Url para pdf ou recurso
    pdfUrl?: string;
    createdAt: string;
}

export type BankTransactionStatus = 'pending' | 'reconciled';

export interface BankTransaction {
    id: string;
    companyId: string;
    date: string;
    description: string;
    amount: number; // Positivo (entrada) ou Negativo (saída)
    type: 'credit' | 'debit';
    status: BankTransactionStatus;
    matchedEntryId?: string; // ID do AccountingEntry se conciliado
}

export interface TaxObligation {
    id: string;
    companyId: string;
    month: string; // ex: "2026-03"
    name: string; // ex: "DAS (Simples Nacional)"
    amount: number;
    dueDate: string;
    status: 'pending' | 'paid';
    paymentDate?: string;
}

export interface AccountingSettings {
    companyId: string;
    taxRegime: 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
    taxRatePercentage: number;
    taxRate: number;
    // MEI Settings
    meiActivityType?: 'commerce' | 'service' | 'both';
    // NFe Settings
    nfeApiToken?: string;
    nfeEnvironment?: 'homologacao' | 'producao';
}
