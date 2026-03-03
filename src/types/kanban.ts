export interface CompanyContact {
  id: string;
  label: string; // e.g., "Financeiro", "Vendas", "Geral"
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
  createdAt: string;
}

export type BudgetType = 'Produto' | 'Serviço' | 'Frete';
export type BudgetStatus = 'Aguardando' | 'Cotado' | 'Aprovado' | 'Recusado';

export interface BudgetItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Budget {
  id: string;
  title: string;
  type: BudgetType;
  status: BudgetStatus;
  companyId?: string; // Linked company (supplier/transporter)
  items: BudgetItem[];
  totalValue: number;
  validity?: string; // e.g. "15 dias"
  notes?: string;
  trashed?: boolean;
  trashedAt?: string;
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
