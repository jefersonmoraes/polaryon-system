export interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
}

export interface Board {
  id: string;
  folderId: string;
  name: string;
  backgroundColor: string;
  backgroundImage?: string;
  createdAt: string;
}

export interface KanbanList {
  id: string;
  boardId: string;
  title: string;
  position: number;
}

export interface Label {
  id: string;
  name: string;
  color: string; // now stores hex color like '#ff0000'
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
  completed: boolean;
  assignee?: string;
  attachments: string[];
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
