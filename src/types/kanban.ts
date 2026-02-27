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
  color: string;
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
  createdAt: string;
}

export const DEFAULT_LABELS: Label[] = [
  { id: 'l1', name: 'Urgente', color: 'red' },
  { id: 'l2', name: 'Importante', color: 'orange' },
  { id: 'l3', name: 'Em progresso', color: 'yellow' },
  { id: 'l4', name: 'Concluído', color: 'green' },
  { id: 'l5', name: 'Bug', color: 'purple' },
  { id: 'l6', name: 'Feature', color: 'blue' },
  { id: 'l7', name: 'Design', color: 'teal' },
  { id: 'l8', name: 'Review', color: 'pink' },
];

export const BOARD_COLORS = [
  '#026AA7', '#4BA3C3', '#519839', '#B04632',
  '#89609E', '#CD5A91', '#4BBF6B', '#00AECC',
  '#838C91', '#172B4D',
];
