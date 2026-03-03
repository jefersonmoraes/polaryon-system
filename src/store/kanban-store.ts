import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Folder, Board, KanbanList, Card, Label, DEFAULT_LABELS, ChecklistItem, Comment, Attachment, WorkspaceMember, Notification, Company, Route, Budget } from '@/types/kanban';

const uid = () => crypto.randomUUID();

interface KanbanState {
  folders: Folder[];
  boards: Board[];
  lists: KanbanList[];
  cards: Card[];
  labels: Label[];
  members: WorkspaceMember[];
  companies: Company[];
  routes: Route[];
  budgets: Budget[];

  undoAction: { cardId: string; previousListId: string; previousPosition: number; message: string; type: 'archived' | 'trashed' | 'moved' } | null;
  setUndoAction: (action: KanbanState['undoAction']) => void;
  executeUndo: () => void;
  clearUndoAction: () => void;
  isDark: boolean;
  uiZoom: number;
  globalSectionOrder: string[];
  boardPreferences: Record<string, { viewMode: 'kanban' | 'calendar' | 'list', sortBy: 'default' | 'priority' | 'assignee' | 'dueDate' }>;
  setGlobalSectionOrder: (order: string[]) => void;
  setBoardPreference: (boardId: string, prefs: Partial<{ viewMode: 'kanban' | 'calendar' | 'list', sortBy: 'default' | 'priority' | 'assignee' | 'dueDate' }>) => void;
  toggleTheme: () => void;
  setUiZoom: (zoom: number) => void;
  // milestones memory
  recentMilestoneTitles: string[];
  addRecentMilestoneTitle: (title: string) => void;
  removeRecentMilestoneTitle: (title: string) => void;
  // notifications
  notifications: Notification[];
  addNotification: (title: string, message: string, link?: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  // companies
  addCompany: (companyData: Omit<Company, 'id' | 'createdAt'>) => void;
  removeCompany: (id: string) => void;
  updateCompany: (id: string, data: Partial<Company>) => void;
  restoreCompany: (id: string) => void;
  permanentlyDeleteCompany: (id: string) => void;
  // routes
  addRoute: (routeData: Omit<Route, 'id' | 'createdAt'>) => void;
  updateRoute: (id: string, data: Partial<Route>) => void;
  deleteRoute: (id: string) => void; // Soft delete
  restoreRoute: (id: string) => void;
  permanentlyDeleteRoute: (id: string) => void;
  // budgets
  addBudget: (budgetData: Omit<Budget, 'id' | 'createdAt'>) => void;
  updateBudget: (id: string, data: Partial<Budget>) => void;
  deleteBudget: (id: string) => void; // Soft delete
  restoreBudget: (id: string) => void;
  permanentlyDeleteBudget: (id: string) => void;
  // folders
  addFolder: (name: string, color?: string, sideImage?: string) => void;
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
  cleanupTrash: () => void;
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
      notifications: [],
      members: [
        { id: 'm1', name: 'João Silva', email: 'joao@jjcorp.com', avatar: 'https://i.pravatar.cc/150?u=joao' },
        { id: 'm2', name: 'Maria Souza', email: 'maria@jjcorp.com', avatar: 'https://i.pravatar.cc/150?u=maria' },
        { id: 'm3', name: 'Carlos Santos', email: 'carlos@jjcorp.com', avatar: 'https://i.pravatar.cc/150?u=carlos' },
      ],
      companies: [],
      routes: [],
      budgets: [],
      undoAction: null,
      isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
      uiZoom: 1,
      recentMilestoneTitles: [],
      globalSectionOrder: ['summary', 'labels', 'assignee', 'dates', 'estimated', 'description', 'attachments', 'checklist', 'timer', 'comments'],
      boardPreferences: {},

      setGlobalSectionOrder: (order) => set({ globalSectionOrder: order }),
      setBoardPreference: (boardId, prefs) => set(s => ({
        boardPreferences: {
          ...s.boardPreferences,
          [boardId]: { ...s.boardPreferences[boardId] || { viewMode: 'kanban', sortBy: 'default' }, ...prefs }
        }
      })),

      setUiZoom: (zoom) => set({ uiZoom: zoom }),

      setUndoAction: (action) => set({ undoAction: action }),
      clearUndoAction: () => set({ undoAction: null }),
      executeUndo: () => {
        const state = get();
        if (!state.undoAction) return;
        const { cardId, previousListId, previousPosition, type } = state.undoAction;

        if (type === 'archived' || type === 'trashed') {
          state.updateCard(cardId, { archived: false, trashed: false });
        }

        state.moveCard(cardId, previousListId, previousPosition);
        set({ undoAction: null });
      },

      toggleTheme: () => set(s => {
        const next = !s.isDark;
        document.documentElement.classList.toggle('dark', next);
        return { isDark: next };
      }),

      // Milestones Memory
      addRecentMilestoneTitle: (title) => set(s => {
        const unique = new Set([title, ...s.recentMilestoneTitles]);
        return { recentMilestoneTitles: Array.from(unique).slice(0, 10) }; // Keep top 10
      }),
      removeRecentMilestoneTitle: (title) => set(s => ({
        recentMilestoneTitles: s.recentMilestoneTitles.filter(t => t !== title)
      })),

      // Notifications
      addNotification: (title, message, link) => set(s => ({
        notifications: [{ id: uid(), title, message, link, read: false, createdAt: new Date().toISOString() }, ...s.notifications]
      })),
      markNotificationRead: (id) => set(s => ({
        notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n)
      })),
      markAllNotificationsRead: () => set(s => ({
        notifications: s.notifications.map(n => ({ ...n, read: true }))
      })),
      clearNotifications: () => set({ notifications: [] }),

      // Companies
      addCompany: (companyData) => set(s => ({
        companies: [{ ...companyData, id: uid(), createdAt: new Date().toISOString() }, ...s.companies]
      })),
      removeCompany: (id) => set(s => ({
        companies: s.companies.filter(c => c.id !== id)
      })),
      updateCompany: (id, data) => set(s => ({
        companies: s.companies.map(c => c.id === id ? { ...c, ...data } : c)
      })),
      restoreCompany: (id) => set(s => ({
        companies: s.companies.map(c => c.id === id ? { ...c, trashed: false, trashedAt: undefined } : c)
      })),
      permanentlyDeleteCompany: (id) => set(s => ({
        companies: s.companies.filter(c => c.id !== id)
      })),

      // Routes
      addRoute: (routeData) => set(s => ({
        routes: [...s.routes, { ...routeData, id: uid(), createdAt: new Date().toISOString() }]
      })),
      updateRoute: (id, data) => set(s => ({
        routes: s.routes.map(r => r.id === id ? { ...r, ...data } : r)
      })),
      deleteRoute: (id) => set(s => ({
        routes: s.routes.map(r => r.id === id ? { ...r, trashed: true } : r)
      })),
      restoreRoute: (id) => set(s => ({
        routes: s.routes.map(r => r.id === id ? { ...r, trashed: false } : r)
      })),
      permanentlyDeleteRoute: (id) => set(s => ({
        routes: s.routes.filter(r => r.id !== id)
      })),

      // Budgets
      addBudget: (budgetData) => set(s => ({
        budgets: [{ ...budgetData, id: uid(), createdAt: new Date().toISOString() }, ...s.budgets]
      })),
      updateBudget: (id, data) => set(s => ({
        budgets: s.budgets.map(b => b.id === id ? { ...b, ...data } : b)
      })),
      deleteBudget: (id) => set(s => ({
        budgets: s.budgets.map(b => b.id === id ? { ...b, trashed: true, trashedAt: new Date().toISOString() } : b)
      })),
      restoreBudget: (id) => set(s => ({
        budgets: s.budgets.map(b => b.id === id ? { ...b, trashed: false, trashedAt: undefined } : b)
      })),
      permanentlyDeleteBudget: (id) => set(s => ({
        budgets: s.budgets.filter(b => b.id !== id)
      })),

      // Folders
      addFolder: (name, color = '#026AA7', sideImage) => set(s => ({
        folders: [...s.folders, { id: uid(), name, color, icon: '📁', sideImage, createdAt: new Date().toISOString() }]
      })),
      updateFolder: (id, data) => set(s => ({
        folders: s.folders.map(f => {
          if (f.id === id) {
            const isTrashing = data.trashed === true && !f.trashed;
            return {
              ...f,
              ...data,
              trashedAt: isTrashing ? new Date().toISOString() : (data.trashed === false ? undefined : f.trashedAt)
            }
          }
          return f;
        })
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
        boards: s.boards.map(b => {
          if (b.id === id) {
            const isTrashing = data.trashed === true && !b.trashed;
            return {
              ...b,
              ...data,
              trashedAt: isTrashing ? new Date().toISOString() : (data.trashed === false ? undefined : b.trashedAt)
            }
          }
          return b;
        })
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
        lists: s.lists.map(l => {
          if (l.id === id) {
            const isTrashing = data.trashed === true && !l.trashed;
            return {
              ...l,
              ...data,
              trashedAt: isTrashing ? new Date().toISOString() : (data.trashed === false ? undefined : l.trashedAt)
            }
          }
          return l;
        })
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
            archived: false, trashed: false,
            attachments: [], timeEntries: [], createdAt: new Date().toISOString(),
          }]
        };
      }),
      updateCard: (id, data) => set(s => ({
        cards: s.cards.map(c => {
          if (c.id === id) {
            const isTrashing = data.trashed === true && !c.trashed;
            return {
              ...c,
              ...data,
              trashedAt: isTrashing ? new Date().toISOString() : (data.trashed === false ? undefined : c.trashedAt)
            };
          }
          return c;
        })
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
      cleanupTrash: () => set(s => {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - 15);
        return {
          cards: s.cards.filter(c => {
            if (!c.trashed || !c.trashedAt) return true;
            return new Date(c.trashedAt) >= threshold;
          }),
          lists: s.lists.filter(l => {
            if (!l.trashed || !l.trashedAt) return true;
            return new Date(l.trashedAt) >= threshold;
          }),
          boards: s.boards.filter(b => {
            if (!b.trashed || !b.trashedAt) return true;
            return new Date(b.trashedAt) >= threshold;
          }),
          folders: s.folders.filter(f => {
            if (!f.trashed || !f.trashedAt) return true;
            return new Date(f.trashedAt) >= threshold;
          }),
          companies: s.companies.filter(c => {
            if (!c.trashed || !c.trashedAt) return true;
            return new Date(c.trashedAt) >= threshold;
          }),
          budgets: s.budgets.filter(b => {
            if (!b.trashed || !b.trashedAt) return true;
            return new Date(b.trashedAt) >= threshold;
          })
        };
      }),

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
