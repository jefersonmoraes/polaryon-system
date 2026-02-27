import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Folder, Board, KanbanList, Card, Label, DEFAULT_LABELS, ChecklistItem, Comment } from '@/types/kanban';

const uid = () => crypto.randomUUID();

interface KanbanState {
  folders: Folder[];
  boards: Board[];
  lists: KanbanList[];
  cards: Card[];
  labels: Label[];
  isDark: boolean;
  toggleTheme: () => void;
  // folders
  addFolder: (name: string, color?: string) => void;
  updateFolder: (id: string, data: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  // boards
  addBoard: (folderId: string, name: string, color?: string) => void;
  updateBoard: (id: string, data: Partial<Board>) => void;
  deleteBoard: (id: string) => void;
  // lists
  addList: (boardId: string, title: string) => void;
  updateList: (id: string, data: Partial<KanbanList>) => void;
  deleteList: (id: string) => void;
  reorderLists: (boardId: string, listIds: string[]) => void;
  // cards
  addCard: (listId: string, title: string) => void;
  updateCard: (id: string, data: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  moveCard: (cardId: string, toListId: string, newPosition: number) => void;
  reorderCards: (listId: string, cardIds: string[]) => void;
  // checklist
  addChecklistItem: (cardId: string, text: string) => void;
  toggleChecklistItem: (cardId: string, itemId: string) => void;
  deleteChecklistItem: (cardId: string, itemId: string) => void;
  // comments
  addComment: (cardId: string, text: string) => void;
  // labels
  addLabel: (name: string, color: string) => void;
  updateLabel: (id: string, data: Partial<Label>) => void;
  deleteLabel: (id: string) => void;
  // time tracking
  startTimer: (cardId: string) => void;
  stopTimer: (cardId: string) => void;
  resetTimer: (cardId: string) => void;
}

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set, get) => ({
      folders: [],
      boards: [],
      lists: [],
      cards: [],
      labels: [...DEFAULT_LABELS],
      isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,

      toggleTheme: () => set(s => {
        const next = !s.isDark;
        document.documentElement.classList.toggle('dark', next);
        return { isDark: next };
      }),

      // Folders
      addFolder: (name, color = '#026AA7') => set(s => ({
        folders: [...s.folders, { id: uid(), name, color, icon: '📁', createdAt: new Date().toISOString() }]
      })),
      updateFolder: (id, data) => set(s => ({
        folders: s.folders.map(f => f.id === id ? { ...f, ...data } : f)
      })),
      deleteFolder: (id) => set(s => {
        const boardIds = s.boards.filter(b => b.folderId === id).map(b => b.id);
        const listIds = s.lists.filter(l => boardIds.includes(l.boardId)).map(l => l.id);
        return {
          folders: s.folders.filter(f => f.id !== id),
          boards: s.boards.filter(b => b.folderId !== id),
          lists: s.lists.filter(l => !boardIds.includes(l.boardId)),
          cards: s.cards.filter(c => !listIds.includes(c.listId)),
        };
      }),

      // Boards
      addBoard: (folderId, name, color = '#026AA7') => set(s => ({
        boards: [...s.boards, { id: uid(), folderId, name, backgroundColor: color, createdAt: new Date().toISOString() }]
      })),
      updateBoard: (id, data) => set(s => ({
        boards: s.boards.map(b => b.id === id ? { ...b, ...data } : b)
      })),
      deleteBoard: (id) => set(s => {
        const listIds = s.lists.filter(l => l.boardId === id).map(l => l.id);
        return {
          boards: s.boards.filter(b => b.id !== id),
          lists: s.lists.filter(l => l.boardId !== id),
          cards: s.cards.filter(c => !listIds.includes(c.listId)),
        };
      }),

      // Lists
      addList: (boardId, title) => set(s => {
        const maxPos = Math.max(0, ...s.lists.filter(l => l.boardId === boardId).map(l => l.position));
        return { lists: [...s.lists, { id: uid(), boardId, title, position: maxPos + 1 }] };
      }),
      updateList: (id, data) => set(s => ({
        lists: s.lists.map(l => l.id === id ? { ...l, ...data } : l)
      })),
      deleteList: (id) => set(s => ({
        lists: s.lists.filter(l => l.id !== id),
        cards: s.cards.filter(c => c.listId !== id),
      })),
      reorderLists: (boardId, listIds) => set(s => ({
        lists: s.lists.map(l => {
          if (l.boardId !== boardId) return l;
          const idx = listIds.indexOf(l.id);
          return idx >= 0 ? { ...l, position: idx } : l;
        })
      })),

      // Cards
      addCard: (listId, title) => set(s => {
        const maxPos = Math.max(0, ...s.cards.filter(c => c.listId === listId).map(c => c.position));
        return {
          cards: [...s.cards, {
            id: uid(), listId, title, summary: '', description: '', position: maxPos + 1,
            labels: [], checklist: [], comments: [], completed: false,
            attachments: [], timeEntries: [], createdAt: new Date().toISOString(),
          }]
        };
      }),
      updateCard: (id, data) => set(s => ({
        cards: s.cards.map(c => c.id === id ? { ...c, ...data } : c)
      })),
      deleteCard: (id) => set(s => ({ cards: s.cards.filter(c => c.id !== id) })),
      moveCard: (cardId, toListId, newPosition) => set(s => ({
        cards: s.cards.map(c => c.id === cardId ? { ...c, listId: toListId, position: newPosition } : c)
      })),
      reorderCards: (listId, cardIds) => set(s => ({
        cards: s.cards.map(c => {
          if (c.listId !== listId) return c;
          const idx = cardIds.indexOf(c.id);
          return idx >= 0 ? { ...c, position: idx } : c;
        })
      })),

      // Checklist
      addChecklistItem: (cardId, text) => set(s => ({
        cards: s.cards.map(c => c.id === cardId ? {
          ...c, checklist: [...c.checklist, { id: uid(), text, completed: false }]
        } : c)
      })),
      toggleChecklistItem: (cardId, itemId) => set(s => ({
        cards: s.cards.map(c => c.id === cardId ? {
          ...c, checklist: c.checklist.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i)
        } : c)
      })),
      deleteChecklistItem: (cardId, itemId) => set(s => ({
        cards: s.cards.map(c => c.id === cardId ? {
          ...c, checklist: c.checklist.filter(i => i.id !== itemId)
        } : c)
      })),

      // Comments
      addComment: (cardId, text) => set(s => ({
        cards: s.cards.map(c => c.id === cardId ? {
          ...c, comments: [...c.comments, { id: uid(), text, author: 'Você', createdAt: new Date().toISOString() }]
        } : c)
      })),

      // Labels
      addLabel: (name, color) => set(s => ({
        labels: [...s.labels, { id: uid(), name, color }]
      })),
      updateLabel: (id, data) => set(s => ({
        labels: s.labels.map(l => l.id === id ? { ...l, ...data } : l)
      })),
      deleteLabel: (id) => set(s => ({
        labels: s.labels.filter(l => l.id !== id),
        cards: s.cards.map(c => ({ ...c, labels: c.labels.filter(l => l !== id) }))
      })),

      // Time tracking
      startTimer: (cardId) => set(s => ({
        cards: s.cards.map(c => c.id === cardId ? {
          ...c, timeEntries: [...c.timeEntries, { id: uid(), startedAt: new Date().toISOString(), duration: 0 }]
        } : c)
      })),
      stopTimer: (cardId) => set(s => ({
        cards: s.cards.map(c => {
          if (c.id !== cardId) return c;
          const entries = [...c.timeEntries];
          const last = entries[entries.length - 1];
          if (last && !last.endedAt) {
            const dur = Math.floor((Date.now() - new Date(last.startedAt).getTime()) / 1000);
            entries[entries.length - 1] = { ...last, endedAt: new Date().toISOString(), duration: dur };
          }
          return { ...c, timeEntries: entries };
        })
      })),
      resetTimer: (cardId) => set(s => ({
        cards: s.cards.map(c => c.id === cardId ? { ...c, timeEntries: [] } : c)
      })),
    }),
    { name: 'jj-kanban-store' }
  )
);

// Initialize theme on load
const initTheme = () => {
  const stored = localStorage.getItem('jj-kanban-store');
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed.state?.isDark) {
      document.documentElement.classList.add('dark');
    }
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
  }
};
initTheme();
