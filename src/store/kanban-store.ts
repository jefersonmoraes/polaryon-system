import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Folder, Board, KanbanList, Card, Label, DEFAULT_LABELS, ChecklistItem, Comment, Attachment, WorkspaceMember, Notification, Company, Route, Budget, MainCompanyProfile } from '@/types/kanban';
import { useAuditStore } from './audit-store';
import { useAuthStore } from './auth-store';
import api from '@/lib/api';
import { useDocumentStore } from './document-store';
import { useEssentialDocumentStore } from './essential-document-store';
import { useAccountingStore } from './accounting-store';
import { socketService } from '@/lib/socket';

const uid = () => crypto.randomUUID();

interface KanbanState {
  mainCompanies: MainCompanyProfile[];
  addMainCompany: (data: Omit<MainCompanyProfile, 'id'>) => string;
  updateMainCompany: (id: string, data: Partial<MainCompanyProfile>) => void;
  deleteMainCompany: (id: string) => void;
  setDefaultMainCompany: (id: string) => void;
  folders: Folder[];
  boards: Board[];
  lists: KanbanList[];
  cards: Card[];
  savingCards: Set<string>;
  labels: Label[];
  members: WorkspaceMember[];
  companies: Company[];
  routes: Route[];
  budgets: Budget[];
  notifications: Notification[];

  addNotification: (title: string, message: string, link?: string, type?: 'info' | 'success' | 'warning', targetUserId?: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (userId?: string) => void;
  clearNotifications: (userId?: string) => void;

  undoAction: { cardId: string; previousListId: string; previousPosition: number; message: string; type: 'archived' | 'trashed' | 'moved' } | null;
  setUndoAction: (action: KanbanState['undoAction']) => void;
  executeUndo: () => void;
  clearUndoAction: () => void;
  // milestones memory
  recentMilestoneTitles: string[];
  addRecentMilestoneTitle: (title: string) => void;
  removeRecentMilestoneTitle: (title: string) => void;
  // companies
  addCompany: (companyData: Omit<Company, 'id' | 'createdAt'>) => string;
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
  addBudget: (budgetData: Omit<Budget, 'createdAt'> | Omit<Budget, 'id' | 'createdAt'>) => string | void;
  updateBudget: (id: string, data: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => void; // Soft delete
  restoreBudget: (id: string) => void;
  permanentlyDeleteBudget: (id: string) => void;
  // folders
  addFolder: (name: string, color?: string, sideImage?: string) => void;
  updateFolder: (id: string, data: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  permanentlyDeleteFolder: (id: string) => void;
  // boards
  addBoard: (folderId: string, name: string, color?: string) => void;
  updateBoard: (id: string, data: Partial<Board>) => void;
  deleteBoard: (id: string) => void;
  permanentlyDeleteBoard: (id: string) => void;
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
  cleanOldTrash: () => void;
  // checklist
  addChecklistItem: (cardId: string, text: string) => void;
  toggleChecklistItem: (cardId: string, itemId: string) => void;
  deleteChecklistItem: (cardId: string, itemId: string) => void;
  // items
  addCardItem: (cardId: string, name: string, unitValue: number, quantity: number) => void;
  updateCardItem: (cardId: string, itemId: string, data: Partial<{ name: string, unitValue: number, quantity: number }>) => void;
  deleteCardItem: (cardId: string, itemId: string) => void;
  // comments
  addComment: (cardId: string, text: string) => void;
  // labels
  addLabel: (name: string, color: string) => void;
  updateLabel: (id: string, data: Partial<Label>) => void;
  deleteLabel: (id: string) => void;
  updateCardDescriptionSync: (id: string, description: string) => void;
  // description entries
  addDescriptionEntry: (cardId: string, text: string) => void;
  deleteDescriptionEntry: (cardId: string, entryId: string) => void;
  // time tracking
  startTimer: (cardId: string) => void;
  stopTimer: (cardId: string) => void;
  resetTimer: (cardId: string) => void;
  fetchKanbanData: () => Promise<void>;
  fetchCardDetails: (cardId: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;

  // Members Sync
  setMembers: (members: WorkspaceMember[]) => void;

  // React-beautiful-dnd Drag Sync Lock
  googleEvents: any[];
  setGoogleEvents: (events: any[]) => void;
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
  pendingSocketActions: any[];
  processPendingSocketActions: () => void;
}

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set, get) => ({
      mainCompanies: [],
      folders: [],
      boards: [],
      lists: [],
      cards: [],
      savingCards: new Set(),
      labels: [...DEFAULT_LABELS],
      members: [],
      companies: [],
      routes: [],
      budgets: [],
      googleEvents: [],
      notifications: [],
      undoAction: null,
      recentMilestoneTitles: [],
      isDragging: false,
      pendingSocketActions: [],

      setGoogleEvents: (googleEvents) => {
        set({ googleEvents });
        // Broadcast sync to others automatically via proxy
        api.post('/kanban/socketproxy', { 
            store: 'GOOGLE_CALENDAR', 
            type: 'SYNC_COMPLETE', 
            payload: googleEvents 
        }).catch(() => {});
      },

      setIsDragging: (isDragging) => {
        set({ isDragging });
        if (!isDragging) {
          get().processPendingSocketActions();
        }
      },

      processPendingSocketActions: () => {
        const { pendingSocketActions } = get();
        if (pendingSocketActions.length === 0) return;
        
        // Clear queue first to prevent double processing
        set({ pendingSocketActions: [] });
        
        pendingSocketActions.forEach(action => {
            const { type, payload, store } = action;
            if (type === 'ADD_CARD') {
                useKanbanStore.setState(s => {
                    const existingIdx = s.cards.findIndex(c => c.id === payload.id);
                    if (existingIdx >= 0) {
                        // Merge payload into existing card (to catch late-synced details)
                        return {
                            cards: s.cards.map((c, i) => i === existingIdx ? { ...c, ...payload } : c)
                        };
                    }
                    return { cards: [payload, ...s.cards] };
                });
            } else if (type === 'MOVE_CARD') {
                useKanbanStore.setState(s => ({
                    cards: s.cards.map(c => c.id === payload.cardId ? { ...c, listId: payload.toListId, position: payload.newPosition } : c)
                }));
            } else if (type === 'UPDATE_CARD') {
                useKanbanStore.setState(s => ({
                    cards: s.cards.map(c => c.id === payload.id ? { ...c, ...payload.data } : c)
                }));
            } else if (type === 'DELETE_CARD') {
                useKanbanStore.setState(s => ({
                    cards: s.cards.map(c => c.id === payload.id ? { ...c, trashed: true, trashedAt: new Date().toISOString() } : c),
                }));
            } else if (type === 'REORDER_CARDS') {
                useKanbanStore.setState(s => ({
                    cards: s.cards.map(c => {
                        if (c.listId !== payload.listId) return c;
                        const idx = payload.cardIds.indexOf(c.id);
                        return idx >= 0 ? { ...c, position: idx } : c;
                    })
                }));
            } else if (type === 'REORDER_LISTS') {
                useKanbanStore.setState(s => ({
                    lists: s.lists.map(l => {
                        if (l.boardId !== payload.boardId) return l;
                        const idx = payload.listIds.indexOf(l.id);
                        return idx >= 0 ? { ...l, position: idx } : l;
                    })
                }));
            }
            // NEW SYSTEM SYNC ACTIONS
            else if (type === 'ADD_COMPANY') {
                set(s => ({ companies: [...s.companies, payload] }));
            } else if (type === 'UPDATE_COMPANY') {
                set(s => ({ companies: s.companies.map(c => c.id === payload.id ? { ...c, ...payload.data } : c) }));
            } else if (type === 'TRASH_COMPANY') {
                set(s => ({ companies: s.companies.map(c => c.id === payload.id ? { ...c, trashed: true, trashedAt: new Date().toISOString() } : c) }));
            } else if (type === 'RESTORE_COMPANY') {
                set(s => ({ companies: s.companies.map(c => c.id === payload.id ? { ...c, trashed: false, trashedAt: undefined } : c) }));
            } else if (type === 'DELETE_COMPANY') {
                set(s => ({ companies: s.companies.filter(c => c.id !== payload.id) }));
            } else if (type === 'ADD_ROUTE') {
                set(s => ({ routes: [...s.routes, payload] }));
            } else if (type === 'UPDATE_ROUTE') {
                set(s => ({ routes: s.routes.map(r => r.id === payload.id ? { ...r, ...payload.data } : r) }));
            } else if (type === 'TRASH_ROUTE') {
                set(s => ({ routes: s.routes.map(r => r.id === payload.id ? { ...r, trashed: true, trashedAt: new Date().toISOString() } : r) }));
            } else if (type === 'RESTORE_ROUTE') {
                set(s => ({ routes: s.routes.map(r => r.id === payload.id ? { ...r, trashed: false, trashedAt: undefined } : r) }));
            } else if (type === 'DELETE_ROUTE') {
                set(s => ({ routes: s.routes.filter(r => r.id !== payload.id) }));
            } else if (type === 'ADD_BUDGET') {
                set(s => ({ budgets: [...s.budgets, payload] }));
            } else if (type === 'UPDATE_BUDGET') {
                set(s => ({ budgets: s.budgets.map(b => b.id === payload.id ? { ...b, ...payload.data } : b) }));
            } else if (type === 'TRASH_BUDGET') {
                set(s => ({ budgets: s.budgets.map(b => b.id === payload.id ? { ...b, trashed: true, trashedAt: new Date().toISOString() } : b) }));
            } else if (type === 'RESTORE_BUDGET') {
                set(s => ({ budgets: s.budgets.map(b => b.id === payload.id ? { ...b, trashed: false, trashedAt: undefined } : b) }));
            } else if (type === 'DELETE_BUDGET') {
                set(s => ({ budgets: s.budgets.filter(b => b.id !== payload.id) }));
            } else if (type === 'ADD_FOLDER') {
                set(s => ({ folders: [...s.folders, payload] }));
            } else if (type === 'UPDATE_FOLDER') {
                set(s => ({ folders: s.folders.map(f => f.id === payload.id ? { ...f, ...payload.data, updatedAt: new Date().toISOString() } : f) }));
            } else if (type === 'TRASH_FOLDER') {
                set(s => ({ folders: s.folders.map(f => f.id === payload.id ? { ...f, trashed: true, trashedAt: new Date().toISOString() } : f) }));
            } else if (type === 'RESTORE_FOLDER') {
                set(s => ({ folders: s.folders.map(f => f.id === payload.id ? { ...f, trashed: false, trashedAt: undefined } : f) }));
            } else if (type === 'DELETE_FOLDER') {
                set(s => ({ folders: s.folders.filter(f => f.id !== payload.id) }));
            } else if (type === 'ADD_BOARD') {
                set(s => ({ boards: [...s.boards, payload] }));
            } else if (type === 'UPDATE_BOARD') {
                set(s => ({ boards: s.boards.map(b => b.id === payload.id ? { ...b, ...payload.data, updatedAt: new Date().toISOString() } : b) }));
            } else if (type === 'TRASH_BOARD') {
                set(s => ({ boards: s.boards.map(b => b.id === payload.id ? { ...b, trashed: true, trashedAt: new Date().toISOString() } : b) }));
            } else if (type === 'DELETE_BOARD') {
                set(s => ({ boards: s.boards.filter(b => b.id !== payload.id) }));
            } else if (type === 'ADD_LIST') {
                set(s => ({ lists: [...s.lists, payload] }));
            } else if (type === 'UPDATE_LIST') {
                set(s => ({ lists: s.lists.map(l => l.id === payload.id ? { ...l, ...payload.data, updatedAt: new Date().toISOString() } : l) }));
            } else if (type === 'TRASH_LIST') {
                set(s => ({ lists: s.lists.map(l => l.id === payload.id ? { ...l, trashed: true, trashedAt: new Date().toISOString() } : l) }));
            } else if (store === 'GOOGLE_CALENDAR' && type === 'SYNC_COMPLETE') {
                console.log('socket - Received Google Calendar Sync:', payload.length);
                set({ googleEvents: payload });
            }
        });
      },

      setMembers: (members) => set({ members }),

      fetchKanbanData: async () => {
        try {
          const res = await api.get('/kanban/sync');
          console.log('kanbanStore - Sync Response:', res.data);
          if (res.data) {
            // Feed documentation stores
            if (res.data.companyDocs) {
                console.log('kanbanStore - Syncing Company Docs:', res.data.companyDocs.length);
                useDocumentStore.getState().setDocuments(res.data.companyDocs);
            }
            if (res.data.essentialDocs) {
                console.log('kanbanStore - Syncing Essential Docs:', res.data.essentialDocs.length);
                useEssentialDocumentStore.getState().setModels(res.data.essentialDocs);
            }
            if (res.data.certificates) {
                console.log('kanbanStore - Syncing Certificates:', res.data.certificates.length);
                // Import do store de certificados feito de forma dinâmica para evitar dependência circular
                const { useCertificateStore } = await import('./certificate-store');
                useCertificateStore.getState().setCertificates(res.data.certificates);
            }
            if (res.data.accounting) {
                console.log('kanbanStore - Syncing Accounting data');
                useAccountingStore.getState().setAllData(res.data.accounting);
            }
            if (res.data.auditLogs) {
                console.log('kanbanStore - Syncing Audit Logs:', res.data.auditLogs.length);
                useAuditStore.getState().setLogs(res.data.auditLogs);
            }

            // SMART MERGE: Prevent newly added local cards from disappearing during sync
            // A card is kept if it's already in the server response OR if it's "very recent" (last 2 mins)
            const serverCards = res.data.cards || [];
            const localCards = get().cards;
            const now = new Date().getTime();
            const TWO_MINUTES = 120000;

            const mergedCards = [...serverCards];
            
            // Add local cards that are not in server response yet but are "fresh"
            localCards.forEach(lc => {
                const alreadyInServer = serverCards.some(sc => sc.id === lc.id || (lc.pncpId && sc.pncpId === lc.pncpId));
                const isRecent = lc.createdAt && (now - new Date(lc.createdAt).getTime() < TWO_MINUTES);
                
                if (!alreadyInServer && isRecent) {
                    console.log('kanbanStore - Keeping optimistic card during sync:', lc.title);
                    mergedCards.unshift(lc);
                }
            });

            set({
              folders: res.data.folders || [],
              boards: res.data.boards || [],
              lists: res.data.lists || [],
              cards: mergedCards,
              members: res.data.members || [],
              labels: (res.data.labels && res.data.labels.length > 0) ? res.data.labels : (get().labels.length > 0 ? get().labels : [...DEFAULT_LABELS]),
              companies: res.data.companies || [],
              mainCompanies: res.data.mainCompanies || [],
              routes: res.data.routes || [],
              budgets: res.data.budgets || [],
              notifications: res.data.notifications || [],
            });
          }
        } catch (error) {
          console.error("Failed to load Kanban data from DB:", error);
        }
      },

      fetchCardDetails: async (id: string) => {
        // If we are currently saving this card, DONT fetch and overwrite local state
        if (get().savingCards.has(id)) {
            console.log(`[STASH] Ignorando fetchCardDetails para ${id} pois há salvamento em curso.`);
            return;
        }

        try {
            const response = await api.get(`/kanban/cards/${id}`);
            const card = response.data;
            
            // Re-check before applying to avoid race conditions
            if (get().savingCards.has(id)) return;

            set(s => ({
              cards: s.cards.map(c => c.id === id ? { 
                  ...card, 
                  description: c.description !== null && c.description !== undefined ? c.description : card.description 
              } : c)
            }));
        } catch (error) {
            console.error("Failed to fetch card details:", error);
        }
      },

      fetchNotifications: async () => {
        try {
          const res = await api.get('/kanban/notifications');
          if (res.data) {
            set(s => {
              // Only override notifications, keeping other state intact.
              // Merge to prevent UI flicker
              return { notifications: res.data };
            });
          }
        } catch (error) {
          console.error("Failed to fetch notifications:", error);
        }
      },

      addNotification: (title, message, link, type = 'info', targetUserId) => {
        const newNotif = { id: uid(), title, message, link, read: false, createdAt: new Date().toISOString(), type, userId: targetUserId };
        set(s => ({ notifications: [newNotif, ...s.notifications] }));
        api.post('/kanban/notifications', newNotif).catch(console.error);
      },
      markNotificationRead: (id) => {
        set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) }));
        api.put(`/kanban/notifications/${id}`, { read: true }).catch(console.error);
      },
      markAllNotificationsRead: (userId) => {
        set(s => {
          const toMark = s.notifications.filter(n => !n.read && (!userId || n.userId === userId || !n.userId));
          toMark.forEach(n => {
            api.put(`/kanban/notifications/${n.id}`, { read: true }).catch(() => {});
          });
          return {
            notifications: s.notifications.map(n => {
              if (!userId || n.userId === userId || !n.userId) return { ...n, read: true };
              return n;
            })
          };
        });
      },
      clearNotifications: (userId) => {
        set(s => {
          const toDelete = s.notifications.filter(n => userId ? (n.userId === userId || !n.userId) : true);
          // Fire deletes
          toDelete.forEach(n => {
             api.delete(`/kanban/notifications/${n.id}`).catch(() => {});
          });
          return {
            notifications: userId ? s.notifications.filter(n => n.userId !== userId && n.userId !== undefined) : []
          };
        });
      },

      setUndoAction: (action) => set({ undoAction: action }),
      clearUndoAction: () => set({ undoAction: null }),

      addMainCompany: (data) => {
        const newId = uid();
        set(s => {
          const isFirst = s.mainCompanies.length === 0;
          return {
            mainCompanies: [...s.mainCompanies, { ...data, id: newId, isDefault: isFirst }]
          };
        });
        const isFirst = get().mainCompanies.length === 1;
        api.post('/kanban/main-companies', { ...data, id: newId, isDefault: isFirst }).catch(console.error);
        return newId;
      },
      updateMainCompany: (id, data) => {
        set(s => ({
          mainCompanies: s.mainCompanies.map(c => c.id === id ? { ...c, ...data } : c)
        }));
        api.put(`/kanban/main-companies/${id}`, data).catch(console.error);
      },
      deleteMainCompany: (id) => {
        set(s => ({
          mainCompanies: s.mainCompanies.filter(c => c.id !== id)
        }));
        api.delete(`/kanban/main-companies/${id}`).catch(console.error);
      },
      setDefaultMainCompany: (id) => set(s => ({
        mainCompanies: s.mainCompanies.map(c => ({
          ...c,
          isDefault: c.id === id
        }))
      })),

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

      // Milestones Memory
      addRecentMilestoneTitle: (title) => set(s => {
        const unique = new Set([title, ...s.recentMilestoneTitles]);
        return { recentMilestoneTitles: Array.from(unique).slice(0, 10) }; // Keep top 10
      }),
      removeRecentMilestoneTitle: (title) => set(s => ({
        recentMilestoneTitles: s.recentMilestoneTitles.filter(t => t !== title)
      })),

      // Companies
      addCompany: (companyData) => {
        const id = uid();
        const createdAt = new Date().toISOString();
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          if (currentUser) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'CRIAR',
              entity: 'EMPRESA',
              details: `Cadastrou o contato comercial "${companyData.nome_fantasia || companyData.razao_social}"`
            });
          }
          return {
            companies: [{ ...companyData, id, createdAt }, ...s.companies]
          };
        });
        api.post('/kanban/companies', { ...companyData, id, createdAt }).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'ADD_COMPANY', payload: { ...companyData, id, createdAt } });
        return id;
      },
      removeCompany: (id) => {
        set(s => ({
          companies: s.companies.filter(c => c.id !== id)
        }));
        api.delete(`/kanban/companies/${id}`).catch(console.error);
      },
      updateCompany: (id, data) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const target = s.companies.find(c => c.id === id);
          if (currentUser && target) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'EDITAR',
              entity: 'EMPRESA',
              details: `Atualizou os dados de negócio de "${target.nome_fantasia || target.razao_social}"`
            });
          }
          return {
            companies: s.companies.map(c => {
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
          };
        });
        api.put(`/kanban/companies/${id}`, data).catch(console.error);
        
        socketService.emit('system_action', { store: 'KANBAN', type: 'UPDATE_COMPANY', payload: { id, data } });
      },
      deleteCompany: (id) => {
        set(s => ({
          companies: s.companies.map(c => c.id === id ? { ...c, trashed: true, trashedAt: new Date().toISOString() } : c)
        }));
        api.put(`/kanban/companies/${id}`, { trashed: true, trashedAt: new Date().toISOString() }).catch(console.error);
        
        socketService.emit('system_action', { store: 'KANBAN', type: 'TRASH_COMPANY', payload: { id } });
      },
      restoreCompany: (id) => {
        set(s => ({
          companies: s.companies.map(c => c.id === id ? { ...c, trashed: false, trashedAt: undefined } : c)
        }));
        api.put(`/kanban/companies/${id}`, { trashed: false, trashedAt: null }).catch(console.error);
        
        socketService.emit('system_action', { store: 'KANBAN', type: 'RESTORE_COMPANY', payload: { id } });
      },
      permanentlyDeleteCompany: (id) => {
        set(s => ({
          companies: s.companies.filter(c => c.id !== id)
        }));
        api.delete(`/kanban/companies/${id}`).catch(console.error);
        
        socketService.emit('system_action', { store: 'KANBAN', type: 'DELETE_COMPANY', payload: { id } });
      },

      // Routes
      addRoute: (routeData) => {
        const id = uid();
        const createdAt = new Date().toISOString();
        const newRoute = { ...routeData, id, createdAt };
        set(s => ({
          routes: [...s.routes, newRoute]
        }));
        api.post('/kanban/routes', newRoute).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'ADD_ROUTE', payload: newRoute });
      },
      updateRoute: (id, data) => {
        set(s => ({
          routes: s.routes.map(r => {
            if (r.id === id) {
              const isTrashing = data.trashed === true && !r.trashed;
              return {
                ...r,
                ...data,
                trashedAt: isTrashing ? new Date().toISOString() : (data.trashed === false ? undefined : r.trashedAt)
              };
            }
            return r;
          })
        }));
        api.put(`/kanban/routes/${id}`, data).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'UPDATE_ROUTE', payload: { id, data } });
      },
      deleteRoute: (id) => {
        set(s => ({
          routes: s.routes.map(r => r.id === id ? { ...r, trashed: true, trashedAt: new Date().toISOString() } : r)
        }));
        api.put(`/kanban/routes/${id}`, { trashed: true, trashedAt: new Date().toISOString() }).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'TRASH_ROUTE', payload: { id } });
      },
      restoreRoute: (id) => {
        set(s => ({
          routes: s.routes.map(r => r.id === id ? { ...r, trashed: false, trashedAt: undefined } : r)
        }));
        api.put(`/kanban/routes/${id}`, { trashed: false, trashedAt: null }).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'RESTORE_ROUTE', payload: { id } });
      },
      permanentlyDeleteRoute: (id) => {
        set(s => ({
          routes: s.routes.filter(r => r.id !== id)
        }));
        api.delete(`/kanban/routes/${id}`).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'DELETE_ROUTE', payload: { id } });
      },

      // Budgets
      addBudget: (budgetData) => {
        // If the UI passes an ID, use it to avoid async sync bugs, otherwise generate
        const id = (budgetData as any).id || uid();
        const createdAt = new Date().toISOString();
        const currentUser = useAuthStore.getState().currentUser;

        set(s => {
          if (currentUser) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'CRIAR',
              entity: 'ORÇAMENTO',
              details: `Criou o orçamento "${budgetData.title}"`
            });
          }
          return {
            budgets: [{ ...budgetData, userId: currentUser?.id, id, createdAt }, ...s.budgets]
          };
        });

        api.post('/kanban/budgets', { ...budgetData, userId: currentUser?.id, id, createdAt }).then(res => {
            const newBudget = { ...budgetData, userId: currentUser?.id, id, createdAt };
            socketService.emit('system_action', { store: 'KANBAN', type: 'ADD_BUDGET', payload: newBudget });
        }).catch(err => {
            console.error("Failed to create budget:", err);
            import('sonner').then(({ toast }) => {
                toast.error("Erro ao criar orçamento no servidor. Verifique sua conexão.");
            });
        });
        
        return id;
      },
      updateBudget: (id, data) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const target = s.budgets.find(b => b.id === id);

          if (currentUser && target) {
            let logMsg = `Editou o orçamento "${target.title}"`;
            let logAction: 'EDITAR' | 'STATUS' = 'EDITAR';

            if (data.status && data.status !== target.status) {
              logMsg = `Marcou o orçamento "${target.title}" como ${data.status.toUpperCase()}`;
              logAction = 'STATUS';
            }

            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: logAction,
              entity: 'ORÇAMENTO',
              details: logMsg
            });
          }
          return {
            budgets: s.budgets.map(b => b.id === id ? { ...b, ...data } : b)
          };
        });
        return api.put(`/kanban/budgets/${id}`, data)
          .then(() => {
              // Successfully saved to DB
              socketService.emit('system_action', { store: 'KANBAN', type: 'UPDATE_BUDGET', payload: { id, data } });
          })
          .catch(err => {
              console.error("Failed to update budget:", err);
              import('sonner').then(({ toast }) => {
                  toast.error("Erro ao salvar alteração no orçamento. Os dados podem não persistir.");
              });
              throw err; // Re-throw so the caller knows it failed
          });
      },
      deleteBudget: (id) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const target = s.budgets.find(b => b.id === id);
          if (currentUser && target) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'EXCLUIR',
              entity: 'ORÇAMENTO',
              details: `Moveu o orçamento "${target.title}" para a Lixeira`
            });
          }
          return {
            budgets: s.budgets.map(b => b.id === id ? { ...b, trashed: true, trashedAt: new Date().toISOString() } : b)
          };
        });
        api.put(`/kanban/budgets/${id}`, { trashed: true, trashedAt: new Date().toISOString() }).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'TRASH_BUDGET', payload: { id } });
      },
      restoreBudget: (id) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const target = s.budgets.find(b => b.id === id);
          if (currentUser && target) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'EDITAR',
              entity: 'ORÇAMENTO',
              details: `Restaurou o orçamento "${target.title}" da Lixeira`
            });
          }
          return {
            budgets: s.budgets.map(b => b.id === id ? { ...b, trashed: false, trashedAt: undefined } : b)
          };
        });
        api.put(`/kanban/budgets/${id}`, { trashed: false, trashedAt: null }).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'RESTORE_BUDGET', payload: { id } });
      },
      permanentlyDeleteBudget: (id) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const target = s.budgets.find(b => b.id === id);
          if (currentUser && target) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'EXCLUIR',
              entity: 'ORÇAMENTO',
              details: `Excluiu permanentemente o orçamento "${target.title}"`
            });
          }
          return {
            budgets: s.budgets.filter(b => b.id !== id)
          };
        });
        api.delete(`/kanban/budgets/${id}`).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'DELETE_BUDGET', payload: { id } });
      },

      // Folders
      addFolder: (name, color = '#3b82f6', sideImage) => {
        const id = uid();
        const now = new Date().toISOString();
        const newFolder = { id, name, color, icon: '📁', sideImage, createdAt: now, updatedAt: now };
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          if (currentUser) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'CRIAR',
              entity: 'QUADRO/LISTA',
              details: `Criou a pasta "${name}"`
            });
          }
          return { folders: [...s.folders, newFolder] };
        });
        api.post('/kanban/folders', newFolder).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'ADD_FOLDER', payload: newFolder });
      },
      updateFolder: (id, data) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const target = s.folders.find(f => f.id === id);
          if (currentUser && target) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'EDITAR',
              entity: 'QUADRO/LISTA',
              details: `Atualizou a pasta "${target.name}"`
            });
          }
          return {
            folders: s.folders.map(f => {
              if (f.id === id) {
                const isTrashing = data.trashed === true && !f.trashed;
                return {
                  ...f,
                  ...data,
                  trashedAt: isTrashing ? new Date().toISOString() : (data.trashed === false ? undefined : f.trashedAt),
                  updatedAt: new Date().toISOString()
                }
              }
              return f;
            })
          };
        });
        api.put(`/kanban/folders/${id}`, { ...data, updatedAt: new Date().toISOString() }).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'UPDATE_FOLDER', payload: { id, data } });
      },
      deleteFolder: (id) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const target = s.folders.find(f => f.id === id);
          if (currentUser && target) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'EXCLUIR',
              entity: 'QUADRO/LISTA',
              details: `Moveu para a lixeira a pasta "${target.name}"`
            });
          }

          const boardIds = s.boards.filter(b => b.folderId === id).map(b => b.id);
          const listIds = s.lists.filter(l => boardIds.includes(l.boardId)).map(l => l.id);
          return {
            folders: s.folders.map(f => f.id === id ? { ...f, trashed: true, trashedAt: new Date().toISOString() } : f),
            boards: s.boards.map(b => boardIds.includes(b.id) ? { ...b, trashed: true, trashedAt: new Date().toISOString() } : b),
            lists: s.lists.map(l => listIds.includes(l.id) ? { ...l, trashed: true, trashedAt: new Date().toISOString() } : l),
            cards: s.cards.map(c => listIds.includes(c.listId) ? { ...c, trashed: true, trashedAt: new Date().toISOString() } : c),
          };
        });
        api.put(`/kanban/folders/${id}`, { trashed: true, trashedAt: new Date().toISOString() }).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'TRASH_FOLDER', payload: { id } });
      },
      restoreFolder: (id) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const target = s.folders.find(f => f.id === id);
          if (currentUser && target) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'EDITAR',
              entity: 'QUADRO/LISTA',
              details: `Restaurou a pasta "${target.name}" da Lixeira`
            });
          }

          const boardIds = s.boards.filter(b => b.folderId === id).map(b => b.id);
          const listIds = s.lists.filter(l => boardIds.includes(l.boardId)).map(l => l.id);
          return {
            folders: s.folders.map(f => f.id === id ? { ...f, trashed: false, trashedAt: undefined } : f),
            boards: s.boards.map(b => boardIds.includes(b.id) ? { ...b, trashed: false, trashedAt: undefined } : b),
            lists: s.lists.map(l => listIds.includes(l.id) ? { ...l, trashed: false, trashedAt: undefined } : l),
            cards: s.cards.map(c => listIds.includes(c.listId) ? { ...c, trashed: false, trashedAt: undefined } : c),
          };
        });
        api.put(`/kanban/folders/${id}`, { trashed: false, trashedAt: null }).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'RESTORE_FOLDER', payload: { id } });
      },
      permanentlyDeleteFolder: (id) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const target = s.folders.find(f => f.id === id);
          if (currentUser && target) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'EXCLUIR',
              entity: 'QUADRO/LISTA',
              details: `Removeu permanentemente a pasta "${target.name}" e seus quadros`
            });
          }
          const boardIds = s.boards.filter(b => b.folderId === id).map(b => b.id);
          const listIds = s.lists.filter(l => boardIds.includes(l.boardId)).map(l => l.id);
          return {
            folders: s.folders.filter(f => f.id !== id),
            boards: s.boards.filter(b => b.folderId !== id),
            lists: s.lists.filter(l => !boardIds.includes(l.boardId)),
            cards: s.cards.filter(c => !listIds.includes(c.listId)),
          };
        });
        api.delete(`/kanban/folders/${id}`).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'DELETE_FOLDER', payload: { id } });
      },

      // Boards
      addBoard: (folderId, name, color = '#3182ce') => {
          const id = uid();
          const now = new Date().toISOString();
          const newBoard = { id, folderId, name, backgroundColor: color, createdAt: now, updatedAt: now };
          set(s => {
            const currentUser = useAuthStore.getState().currentUser;
            if (currentUser) {
                useAuditStore.getState().addLog({
                    userId: currentUser.id,
                    userName: currentUser.name,
                    action: 'CRIAR',
                    entity: 'QUADRO/LISTA',
                    details: `Criou o quadro "${name}"`
                });
            }
            return { boards: [...s.boards, newBoard] };
          });
          api.post('/kanban/boards', newBoard).catch(console.error);
          socketService.emit('system_action', { store: 'KANBAN', type: 'ADD_BOARD', payload: newBoard });
      },
      updateBoard: (id, data) => {
        set(s => ({
          boards: s.boards.map(b => b.id === id ? { ...b, ...data, updatedAt: new Date().toISOString() } : b)
        }));
        api.put(`/kanban/boards/${id}`, data).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'UPDATE_BOARD', payload: { id, data } });
      },
      deleteBoard: (id) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const target = s.boards.find(b => b.id === id);
          if (currentUser && target) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'EXCLUIR',
              entity: 'QUADRO/LISTA',
              details: `Moveu o quadro "${target.name}" para a Lixeira`
            });
          }
          return {
            boards: s.boards.map(b => b.id === id ? { ...b, trashed: true, trashedAt: new Date().toISOString() } : b)
          };
        });
        api.put(`/kanban/boards/${id}`, { trashed: true, trashedAt: new Date().toISOString() }).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'TRASH_BOARD', payload: { id } });
      },
      permanentlyDeleteBoard: (id) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const target = s.boards.find(b => b.id === id);
          if (currentUser && target) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'EXCLUIR',
              entity: 'QUADRO/LISTA',
              details: `Removeu permanentemente o quadro "${target.name}"`
            });
          }
          const listIds = s.lists.filter(l => l.boardId === id).map(l => l.id);
          return {
            boards: s.boards.filter(b => b.id !== id),
            lists: s.lists.filter(l => l.boardId !== id),
            cards: s.cards.filter(c => !listIds.includes(c.listId))
          };
        });
        api.delete(`/kanban/boards/${id}`).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'DELETE_BOARD', payload: { id } });
      },

      // Lists
      addList: (boardId, title) => {
        const id = uid();
        const now = new Date().toISOString();
        const lastList = get().lists.filter(l => l.boardId === boardId).sort((a, b) => (b.position || 0) - (a.position || 0))[0];
        const position = lastList ? (lastList.position || 0) + 1 : 0;
        const newList = { id, boardId, title, position, createdAt: now, updatedAt: now };
        set(s => ({ lists: [...s.lists, newList] }));
        api.post('/kanban/lists', newList).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'ADD_LIST', payload: newList });
      },
      updateList: (id, data) => {
        set(s => ({
          lists: s.lists.map(l => l.id === id ? { ...l, ...data, updatedAt: new Date().toISOString() } : l)
        }));
        api.put(`/kanban/lists/${id}`, data).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'UPDATE_LIST', payload: { id, data } });
      },
      deleteList: (id) => {
        set(s => ({
          lists: s.lists.map(l => l.id === id ? { ...l, trashed: true, trashedAt: new Date().toISOString() } : l),
          cards: s.cards.map(c => c.listId === id ? { ...c, trashed: true, trashedAt: new Date().toISOString() } : c),
        }));
        api.put(`/kanban/lists/${id}`, { trashed: true, trashedAt: new Date().toISOString() }).catch(console.error);
        socketService.emit('system_action', { store: 'KANBAN', type: 'TRASH_LIST', payload: { id } });
      },
      reorderLists: (boardId, listIds) => {
        set(s => ({
          lists: s.lists.map(l => {
            if (l.boardId !== boardId) return l;
            const idx = listIds.indexOf(l.id);
            return idx >= 0 ? { ...l, position: idx } : l;
          })
        }));
        socketService.emit('system_action', { store: 'KANBAN', type: 'REORDER_LISTS', payload: { boardId, listIds } });
      },

      // Cards
      addCard: (listId, title) => {
        let createdCard: any;
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const targetList = s.lists.find(l => l.id === listId);

          if (currentUser && targetList) {
            useAuditStore.getState().addLog({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'CRIAR',
              entity: 'CARTÃO',
              details: `Criou cartão "${title}" na lista "${targetList.title}"`
            });
          }

          const maxPos = Math.max(0, ...s.cards.filter(c => c.listId === listId).map(c => c.position));
          createdCard = {
            id: uid(), listId, title, summary: '', description: '', position: maxPos + 1,
            labels: [], checklist: [], comments: [], completed: false,
            archived: false, trashed: false,
            attachments: [], timeEntries: [], createdAt: new Date().toISOString(),
          };

          return {
            cards: [...s.cards, createdCard]
          };
        });
        socketService.emit('system_action', { store: 'KANBAN', type: 'ADD_CARD', payload: createdCard });
        api.post('/kanban/cards', createdCard).catch(console.error);
      },
      updateCard: async (id, data) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const targetCard = s.cards.find(c => c.id === id);

          if (currentUser && targetCard) {
            let details = `Atualizou dados do cartão "${targetCard.title}"`;

            // Do not log timer tick updates to prevent spamming the logs
            if (data.trashed !== undefined) {
              useAuditStore.getState().addLog({
                userId: currentUser.id,
                userName: currentUser.name,
                action: data.trashed ? 'EXCLUIR' : 'EDITAR',
                entity: 'CARTÃO',
                details: data.trashed ? `Moveu o cartão "${targetCard.title}" para a Lixeira` : `Restaurou o cartão "${targetCard.title}" da Lixeira`
              });
            } else if (!data.timeEntries) {
              useAuditStore.getState().addLog({
                userId: currentUser.id,
                userName: currentUser.name,
                action: 'EDITAR',
                entity: 'CARTÃO',
                details: `Atualizou dados do cartão "${targetCard.title}"${data.description ? ' (Descrição alterada)' : ''}`
              });
              
              // Adicional: Se for uma alteração de descrição crítica, logar mais detalhes
              if (data.description && data.description.length > 500) {
                  console.log(`[AUDIT] Alteração de descrição grande no cartão ${id} (${data.description.length} chars)`);
              }
            }
          }

          let updatedBudgets = s.budgets;

          if (data.trashed !== undefined || data.archived !== undefined) {
            updatedBudgets = s.budgets.map(b => {
              if (b.cardId === id) {
                return {
                  ...b,
                  ...(data.trashed !== undefined ? { trashed: data.trashed, trashedAt: data.trashed ? new Date().toISOString() : undefined } : {}),
                  ...(data.archived !== undefined ? { archived: data.archived } : {}),
                };
              }
              return b;
            });
          }

          return {
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
            }),
            budgets: updatedBudgets
          };
        });

        // AUTO-SYNC GOOGLE CALENDAR EM BACKGROUND
        const currentUser = useAuthStore.getState().currentUser;
        if (currentUser && (currentUser.role === 'ADMIN' || currentUser.permissions?.canEdit)) {
          // If the update involves fields relevant to the calendar, trigger sync silently
          if (data.dueDate !== undefined || data.milestones !== undefined || data.trashed !== undefined || data.archived !== undefined || data.completed !== undefined || data.title) {
            setTimeout(() => {
              const currentCards = get().cards;
              const eventsToPush: any[] = [];

              currentCards.filter(c => !c.archived && !c.trashed && !c.completed).forEach(c => {
                  // Task itself
                  if (c.dueDate) {
                      eventsToPush.push({
                          id: c.id,
                          title: `[Polaryon] ${c.title}`,
                          date: c.dueDate
                      });
                  }
                  
                  // Milestones
                  if (c.milestones) {
                      c.milestones.filter(m => !m.completed && m.dueDate).forEach(m => {
                          eventsToPush.push({
                              id: m.id,
                              title: `[Etapa] ${m.title} - ${c.title}`,
                              date: m.dueDate,
                              time: m.hour
                          });
                      });
                  }
              });

              api.post('/calendar/sync', { eventsToPush }).catch(() => {});
            }, 1000); // Slight delay to ensure state is committed
          }
        }
        
        socketService.emit('system_action', { store: 'KANBAN', type: 'UPDATE_CARD', payload: { id, data } });

        // Lock the card during save to prevent fetchCardDetails overwrites
        set(s => {
            const newSaving = new Set(s.savingCards);
            newSaving.add(id);
            return { savingCards: newSaving };
        });

        try {
            console.log(`[HTTP_PUT] Iniciando salvamento do card ${id}`, data);
            const response = await api.put(`/kanban/cards/${id}`, data);
            console.log(`[HTTP_OK] Card ${id} salvo com sucesso.`);
            return response;
        } catch (error: any) {
            console.error(`[HTTP_ERR] Falha ao salvar card ${id}:`, error.message);
            throw error;
        } finally {
            // Release the lock after some safety buffer (500ms) to ensure DB is consistent
            setTimeout(() => {
                set(s => {
                    const newSaving = new Set(s.savingCards);
                    newSaving.delete(id);
                    return { savingCards: newSaving };
                });
            }, 500);
        }
      },
      updateCardDescriptionSync: (id: string, description: string) => {
        set(s => ({
          cards: s.cards.map(c => c.id === id ? { ...c, description } : c)
        }));
      },
      addDescriptionEntry: (cardId, text) => {
        const id = uid();
        const createdAt = new Date().toISOString();
        const newEntry = { id, text, createdAt };
        
        set(s => ({
          cards: s.cards.map(c => c.id === cardId ? { 
            ...c, 
            descriptionEntries: [...(c.descriptionEntries || []), newEntry] 
          } : c)
        }));

        const card = get().cards.find(c => c.id === cardId);
        if (card) {
          api.put(`/kanban/cards/${cardId}`, { descriptionEntries: card.descriptionEntries }).catch(console.error);
          socketService.emit('system_action', { store: 'KANBAN', type: 'UPDATE_CARD', payload: { id: cardId, data: { descriptionEntries: card.descriptionEntries } } });
        }
      },
      deleteDescriptionEntry: (cardId, entryId) => {
        set(s => ({
          cards: s.cards.map(c => c.id === cardId ? { 
            ...c, 
            descriptionEntries: (c.descriptionEntries || []).filter(e => e.id !== entryId) 
          } : c)
        }));

        const card = get().cards.find(c => c.id === cardId);
        if (card) {
          api.put(`/kanban/cards/${cardId}`, { descriptionEntries: card.descriptionEntries }).catch(console.error);
          socketService.emit('system_action', { store: 'KANBAN', type: 'UPDATE_CARD', payload: { id: cardId, data: { descriptionEntries: card.descriptionEntries } } });
        }
      },
      deleteCard: (id) => {
        set(s => ({
          cards: s.cards.map(c => c.id === id ? { ...c, trashed: true, trashedAt: new Date().toISOString() } : c),
          budgets: s.budgets.map(b => b.cardId === id ? { ...b, trashed: true, trashedAt: new Date().toISOString() } : b)
        }));
        socketService.emit('system_action', { store: 'KANBAN', type: 'DELETE_CARD', payload: { id } });
        api.put(`/kanban/cards/${id}`, { trashed: true }).catch(console.error);
      },
      moveCard: (cardId, toListId, newPosition) => {
        set(s => {
          const currentUser = useAuthStore.getState().currentUser;
          const targetCard = s.cards.find(c => c.id === cardId);
          const targetList = s.lists.find(l => l.id === toListId);

          if (currentUser && targetCard && targetList) {
            // Only log if the list actually changed, otherwise it's just a visual reorder within the same list
            if (targetCard.listId !== toListId) {
              useAuditStore.getState().addLog({
                userId: currentUser.id,
                userName: currentUser.name,
                action: 'MOVER',
                entity: 'CARTÃO',
                details: `Moveu "${targetCard.title}" para a fase/lista "${targetList.title}"`
              });
            }
          }

          return {
            cards: s.cards.map(c => c.id === cardId ? { ...c, listId: toListId, position: newPosition } : c)
          }
        });
        socketService.emit('system_action', { store: 'KANBAN', type: 'MOVE_CARD', payload: { cardId, toListId, newPosition } });
        api.put(`/kanban/cards/${cardId}`, { listId: toListId, position: newPosition }).catch(console.error);
      },
      reorderCards: (listId, cardIds) => {
        set(s => ({
          cards: s.cards.map(c => {
            if (c.listId !== listId) return c;
            const idx = cardIds.indexOf(c.id);
            return idx >= 0 ? { ...c, position: idx } : c;
          })
        }));
        socketService.emit('system_action', { store: 'KANBAN', type: 'REORDER_CARDS', payload: { listId, cardIds } });
        api.post('/kanban/cards/reorder', { listId, cardIds }).catch(console.error);
      },
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
      cleanOldTrash: () => set(s => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return {
          cards: s.cards.filter(c => !c.trashed || !c.trashedAt || new Date(c.trashedAt) >= thirtyDaysAgo),
          lists: s.lists.filter(l => !l.trashed || !l.trashedAt || new Date(l.trashedAt) >= thirtyDaysAgo),
          boards: s.boards.filter(b => !b.trashed || !b.trashedAt || new Date(b.trashedAt) >= thirtyDaysAgo),
          folders: s.folders.filter(f => !f.trashed || !f.trashedAt || new Date(f.trashedAt) >= thirtyDaysAgo),
          companies: s.companies.filter(c => !c.trashed || !c.trashedAt || new Date(c.trashedAt) >= thirtyDaysAgo),
          budgets: s.budgets.filter(b => !b.trashed || !b.trashedAt || new Date(b.trashedAt) >= thirtyDaysAgo),
          routes: s.routes.filter(r => !r.trashed || !r.trashedAt || new Date(r.trashedAt) >= thirtyDaysAgo),
        };
      }),

      // Checklist
      addChecklistItem: (cardId, text) => {
        const c = get().cards.find(x => x.id === cardId);
        if (!c) return;
        get().updateCard(cardId, { checklist: [...c.checklist, { id: uid(), text, completed: false }] });
      },
      toggleChecklistItem: (cardId, itemId) => {
        const c = get().cards.find(x => x.id === cardId);
        if (!c) return;
        get().updateCard(cardId, { checklist: c.checklist.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i) });
      },
      deleteChecklistItem: (cardId, itemId) => {
        const c = get().cards.find(x => x.id === cardId);
        if (!c) return;
        get().updateCard(cardId, { checklist: c.checklist.filter(i => i.id !== itemId) });
      },
      // Items
      addCardItem: (cardId, name, unitValue, quantity) => {
        const c = get().cards.find(x => x.id === cardId);
        if (!c) return;
        get().updateCard(cardId, { items: [...(c.items || []), { id: uid(), name, unitValue, quantity }] });
      },
      updateCardItem: (cardId, itemId, data) => {
        const c = get().cards.find(x => x.id === cardId);
        if (!c) return;
        get().updateCard(cardId, { items: c.items.map(i => i.id === itemId ? { ...i, ...data } : i) });
      },
      deleteCardItem: (cardId, itemId) => {
        const c = get().cards.find(x => x.id === cardId);
        if (!c) return;
        get().updateCard(cardId, { items: c.items.filter(i => i.id !== itemId) });
      },

      // Comments
      addComment: (cardId, text) => {
        const c = get().cards.find(x => x.id === cardId);
        if (!c) return;
        get().updateCard(cardId, { comments: [...c.comments, { id: uid(), text, author: useAuthStore.getState().currentUser?.name || 'Você', createdAt: new Date().toISOString() }] });
      },

      // Labels
      addLabel: (name, color) => {
        const newLabel = { id: uid(), name, color };
        set(s => ({ labels: [...s.labels, newLabel] }));
        api.post('/kanban/labels', newLabel).catch(console.error);
      },
      updateLabel: (id, data) => {
        set(s => ({ labels: s.labels.map(l => l.id === id ? { ...l, ...data } : l) }));
        api.put(`/kanban/labels/${id}`, data).catch(console.error);
      },
      deleteLabel: (id) => {
        set(s => ({
          labels: s.labels.filter(l => l.id !== id),
          cards: s.cards.map(c => ({ ...c, labels: c.labels.filter(l => l !== id) }))
        }));
        api.delete(`/kanban/labels/${id}`).catch(console.error);
      },
      approveBudget: (id) => set(s => ({
        labels: s.labels.filter(l => l.id !== id),
        cards: s.cards.map(c => ({ ...c, labels: c.labels.filter(l => l !== id) }))
      })),

      // Time tracking
      startTimer: (cardId) => {
        const c = get().cards.find(x => x.id === cardId);
        if (!c) return;
        get().updateCard(cardId, { timeEntries: [...c.timeEntries, { id: uid(), startedAt: new Date().toISOString(), duration: 0 }] });
      },
      stopTimer: (cardId) => {
        const c = get().cards.find(x => x.id === cardId);
        if (!c) return;
        const entries = [...c.timeEntries];
        const last = entries[entries.length - 1];
        if (last && !last.endedAt) {
          const dur = Math.floor((Date.now() - new Date(last.startedAt).getTime()) / 1000);
          entries[entries.length - 1] = { ...last, endedAt: new Date().toISOString(), duration: dur };
        }
        get().updateCard(cardId, { timeEntries: entries });
      },
      resetTimer: (cardId) => {
        const c = get().cards.find(x => x.id === cardId);
        if (!c) return;
        get().updateCard(cardId, { timeEntries: [] });
      },
    }),
    { 
      name: 'jj-kanban-v3', // bumped version to wipe corrupted localstorage with large images (exclude attachments)
      /**
       * PROTECTED SECTION: Critical for performance and persistence.
       * Do not remove lists, companies, routes, or budgets from partialize.
       * This prevents the "blank board" effect on page refresh.
       * 
       * V3: Strip "attachments" from cards and budgets to avoid 5MB LocalStorage Quota Exceeded errors.
       */
      partialize: (state) => ({
        googleEvents: state.googleEvents,
        folders: state.folders,
        boards: state.boards,
        lists: state.lists,
        companies: state.companies,
        routes: state.routes,
        labels: state.labels,
        members: state.members,
        // Strip attachments from budgets to keep localstorage light
        budgets: state.budgets.map(b => ({
          ...b,
          items: b.items.map(item => {
            const { attachments, ...rest } = item;
            return rest;
          })
        })),
        // Strip attachments from cards to keep localstorage light
        cards: state.cards.map(c => {
          const { attachments, ...rest } = c;
          return rest;
        })
      })
    }
  )
);

// Initialize theme on load
const initTheme = () => {
  const stored = localStorage.getItem('jj-kanban-v3');
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

// Syncing the Current User's profile updates into the Kanban members instantly without overriding everyone else
useAuthStore.subscribe((state) => {
  const currentUser = state.currentUser;
  if (currentUser) {
    const kanbanMembers = useKanbanStore.getState().members;
    const existing = kanbanMembers.find(m => m.id === currentUser.id);
    if (existing && (existing.name !== currentUser.name || existing.avatar !== currentUser.photoURL)) {
        useKanbanStore.setState({
            members: kanbanMembers.map(m => m.id === currentUser.id ? {
                ...m,
                name: currentUser.name,
                avatar: currentUser.photoURL || m.avatar
            } : m)
        });
    }
  }
});

// Real-time synchronization
socketService.connect();

// Unified System Sync for all events
socketService.on('system_sync', (action: any) => {
    const store = useKanbanStore.getState();
    const { type, payload } = action;

    if (action.store === 'KANBAN') {
        if (store.isDragging) {
            useKanbanStore.setState(s => ({ pendingSocketActions: [...s.pendingSocketActions, action] }));
            return;
        }

        // Direct processing
        if (type === 'ADD_CARD') {
            if (!store.cards.find(c => c.id === payload.id)) {
                useKanbanStore.setState(s => ({ cards: [...s.cards, payload] }));
            }
        } else if (type === 'MOVE_CARD') {
            useKanbanStore.setState(s => ({
                cards: s.cards.map(c => c.id === payload.cardId ? { ...c, listId: payload.toListId, position: payload.newPosition } : c)
            }));
        } else if (type === 'UPDATE_CARD') {
            useKanbanStore.setState(s => ({
                cards: s.cards.map(c => c.id === payload.id ? { ...c, ...payload.data } : c)
            }));
        } else if (type === 'DELETE_CARD') {
             useKanbanStore.setState(s => ({
                cards: s.cards.map(c => c.id === payload.id ? { ...c, trashed: true, trashedAt: new Date().toISOString() } : c),
             }));
        } else if (type === 'REORDER_CARDS') {
            useKanbanStore.setState(s => ({
                cards: s.cards.map(c => {
                    if (c.listId !== payload.listId) return c;
                    const idx = payload.cardIds.indexOf(c.id);
                    return idx >= 0 ? { ...c, position: idx } : c;
                })
            }));
        } else if (type === 'REORDER_LISTS') {
            useKanbanStore.setState(s => ({
                lists: s.lists.map(l => {
                    if (l.boardId !== payload.boardId) return l;
                    const idx = payload.listIds.indexOf(l.id);
                    return idx >= 0 ? { ...l, position: idx } : l;
                })
            }));
        } else {
            // Process non-card system actions (Budgets, Folders, etc)
            const tempQueue = [action];
            const originalQueue = store.pendingSocketActions;
            useKanbanStore.setState({ pendingSocketActions: tempQueue });
            store.processPendingSocketActions();
            useKanbanStore.setState({ pendingSocketActions: originalQueue });
        }
    } else if (action.store === 'GOOGLE_CALENDAR') {
        // Shared Google Events state update
        if (action.type === 'SYNC_COMPLETE') {
            useKanbanStore.getState().setGoogleEvents(action.payload);
        }
    }
});
