export interface CompanyContact {
  id: string;
  label: string; // e.g., "Financeiro", "Vendas", "Geral"
  type?: 'Telefone' | 'Email';
  phone?: string;
  email?: string;
  isWhatsapp?: boolean;
}

export interface Route {
  id: string;
  name: string; // e.g., "Rio - São Paulo"
  origin: string;
  destination: string;
  transporterIds: string[]; // Ordered list of preferred transporters
  isFavorite?: boolean;
  trashed?: boolean;
  trashedAt?: string;
  createdAt: string;
}

export type BudgetType = 'Produto' | 'Serviço';
export type BudgetStatus = 'Aguardando' | 'Cotado' | 'Aprovado' | 'Recusado';

export interface QuotationSubItem {
  id: string;
  description: string;
  quantity: number;
  discountValue?: number;
  // New fields for tracking linkage with Kanban cards
  linkedKanbanCardId?: string; // Linked company (supplier) specific to this quote
  transporterId?: string; // Linked company (transporter) specific to this quote
  validity?: string; // e.g., "15 dias"
  notes?: string;

  // Fase 3: Favoritos e Avaliações de Empresas
  unitPrice: number;
  totalPrice: number;
}

export interface BudgetItem {
  id: string;
  companyId?: string; // Linked company (supplier) specific to this quote
  transporterId?: string; // Linked company (transporter) specific to this quote
  validity?: string; // e.g. "15 dias"
  notes?: string;

  // Fase 3: Favoritos e Avaliações de Empresas
  isFavorite?: boolean;
  supplierRating?: number; // 0 to 5 estrelas
  transporterRating?: number; // 0 to 5 estrelas

  // Novos Campos da Negociação (Escopo Global da Cotação)
  freightValue?: number; // CIF = valor do frete q soma com total
  hasInvoiceTriangulation?: boolean; // Triangulação de NF na Transportadora
  warrantyDays?: string; // Quantidade de dias da garantia fornecida
  hasInsurance?: boolean; // Seguro de carga ativado/desativado
  deliveryTime?: string; // MANTIDO POR RETROCOMPATIBILIDADE (Prazo de entrega string - ex: "5 dias úteis")
  deliveryDate?: string; // NOVO: Data de entrega (input date YYYY-MM-DD)
  hasServiceContract?: boolean; // Contrato de prestação de serviços (sim/não)
  emitsResaleInvoice?: boolean; // Emite NF de revenda? (sim/não)

  paymentTerms?: 'À vista' | 'Boleto' | 'PIX' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Transferência Bancária' | string; // Condições de Pagamento
  hasCashDiscount?: boolean; // TOGGLE: Aplicar Desconto
  cashDiscount?: number; // Valor numerico do desconto do Toggle
  installmentsCount?: number; // Qtd de vezes do Parcelamento
  installmentInterest?: number; // % do Juros mensal sobre o parcelamento

  invoicedSales?: boolean; // Vende Faturado
  invoiceTerm?: string; // Prazo de Faturamento

  // Price Calculation & Taxes Base
  mainCompanyId?: string; // ID da Administradora Padrão Selecionada
  destinationState?: string; // Estado de Destino
  profitMargin?: number; // Margem de Lucro percentual desejada (Markup divisor)
  difalValue?: number; // Valor nominal somado de DIFAL
  taxValue?: number; // Valor nominal somado TOTAL de impostos (para legados)

  // Tax Detalhamento Individual (Fase 4 Pricing)
  taxesBreakdown?: {
    pis: number;
    cofins: number;
    csll: number;
    irpj: number;
    cpp: number;
    iss: number;
    icms: number;
    ipi: number;
    total: number;
  };

  difalBreakdown?: {
    origin: string;
    destination: string;
    internal: number;
    interstate: number;
    percent: number;
  };

  finalSellingPrice?: number; // Preço Final do Fornecedor baseado no Custo + Margem

  items: QuotationSubItem[]; // The products/services inside this quote
  totalPrice: number; // Sum of all inner items + freightValue - cashDiscount + Installments (CUSTO INICIAL)
}

export interface Budget {
  id: string;
  title: string;
  address?: string;
  deliveryTime?: string;
  type: BudgetType;
  userId?: string;
  status: BudgetStatus;
  cardId?: string; // Linked kanban card
  items: BudgetItem[]; // Now called "Cotações"
  totalValue: number;
  trashed?: boolean;
  trashedAt?: string;
  archived?: boolean;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
  sideImage?: string;
  createdAt: string;
  archived?: boolean;
  trashed?: boolean;
  trashedAt?: string;
}

export interface Company {
  id: string;
  type: 'Fornecedor' | 'Transportadora';
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  nickname?: string;
  descricao_situacao_cadastral: string;
  cnae_fiscal_descricao: string;
  cep: string;
  uf: string;
  municipio: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;

  // Legacy fields (kept for compatibility)
  ddd_telefone_1?: string;
  ddd_telefone_2?: string;
  email?: string;

  // New fields
  contacts?: CompanyContact[];
  comments?: string;

  // Supplier specific
  amostra?: boolean;
  frete?: 'CIF' | 'FOB' | '';
  mantemOferta?: string;
  areasAtuacao?: string[];
  lastCnpjCheck?: string; // ISODateString of the last check via BrasilAPI

  // Transporter specific
  seguroCarga?: boolean;

  customLink?: string;
  rating?: number;
  isFavorite?: boolean;
  trashed?: boolean;
  trashedAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
  type?: 'info' | 'success' | 'warning';
  userId?: string;
}

export interface MainCompanyProfile {
  id: string;
  isDefault?: boolean;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  state: string; // UF
  porte: string; // e.g. 'MEI', 'ME', 'EPP'
  lastSynced?: string; // ISO String indicating the last time it was fetched via API
  dataSource?: string; // e.g. 'Brasil API', 'Receita Federal', etc.

  // Accounting & Corporate fields
  naturezaJuridica: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  telefone: string;
  email: string;
  cnaes: { code: string; description: string }[];

  taxRegime: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | '';
  simplesAnnexes: string[]; // e.g., 'Anexo I', 'Anexo II', etc.

  // Tax aliquots (percentages)
  pis: number;
  cofins: number;
  csll: number;
  irpj: number;
  cpp: number;
  iss: number;
  icms: number;
  ipi: number;

  // Custom overrides per annex for Simples Nacional
  annexRates?: Record<string, {
    pis: number; cofins: number; csll: number; irpj: number; cpp: number; iss: number; icms: number; ipi: number;
  }>;
}

export interface Board {
  id: string;
  folderId: string;
  name: string;
  backgroundColor: string;
  backgroundImage?: string;
  createdAt: string;
  archived?: boolean;
  trashed?: boolean;
  trashedAt?: string;
  isFavorite?: boolean;
}

export interface KanbanList {
  id: string;
  boardId: string;
  title: string;
  position: number;
  color?: string;
  icon?: string;
  // Automations: list of actions to perform when a card is dropped
  automations?: Array<{
    type: 'move-to-board' | 'archive' | 'trash' | 'mark-completed' | 'mark-milestone';
    targetBoardId?: string;
    targetMilestoneTitle?: string;
  }>;
  archived?: boolean;
  trashed?: boolean;
  trashedAt?: string;
}

export interface Label {
  id: string;
  name: string;
  color: string; // now stores hex color like '#ff0000'
  icon?: string;
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  startedAt: string;
  endedAt?: string;
  duration: number; // seconds
}

export interface Attachment {
  id: string;
  name: string;
  url: string; // data URL for local storage
  type: string; // mime type
  addedAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  dueDate?: string;
  hour?: string; // NOVO: Campo de hora (ex: "14:30")
  completed: boolean;
}

export interface Card {
  id: string;
  listId: string;
  title: string;
  summary: string;
  description: string;
  position: number;
  labels: string[]; // label ids
  checklist: ChecklistItem[];
  comments: Comment[];
  dueDate?: string;
  startDate?: string;
  milestones?: Milestone[];
  completed: boolean;
  archived: boolean;
  trashed: boolean;
  trashedAt?: string; // ISO string when sent to trash
  assignee?: string;
  automationUndoAction?: {
    previousListId: string;
    timestamp: number;
    message: string;
  };
  attachments: Attachment[];
  timeEntries: TimeEntry[];
  estimatedTime?: number; // minutes
  customLink?: string; // Editável para links externos como PNCP
  pncpId?: string; // Para o botão interno de Acessar Oportunidade
  deliveryAddress?: string;
  deliveryTime?: string;
  createdAt: string;
}

export const DEFAULT_LABELS: Label[] = [
  { id: 'l1', name: 'Urgente', color: '#ef4444' },
  { id: 'l2', name: 'Importante', color: '#f97316' },
  { id: 'l3', name: 'Em progresso', color: '#eab308' },
  { id: 'l4', name: 'Concluído', color: '#22c55e' },
  { id: 'l5', name: 'Bug', color: '#a855f7' },
  { id: 'l6', name: 'Feature', color: '#3b82f6' },
  { id: 'l7', name: 'Design', color: '#14b8a6' },
  { id: 'l8', name: 'Review', color: '#ec4899' },
];

export const BOARD_COLORS = [
  '#026AA7', '#4BA3C3', '#519839', '#B04632',
  '#89609E', '#CD5A91', '#4BBF6B', '#00AECC',
  '#838C91', '#172B4D',
];

export const PREDEFINED_LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
  '#84cc16', '#06b6d4', '#8b5cf6', '#d946ef', '#0ea5e9',
  '#10b981', '#f59e0b', '#64748b', '#1e293b', '#78716c',
];
