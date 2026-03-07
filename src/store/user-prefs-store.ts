import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Notification } from '@/types/kanban';

const uid = () => crypto.randomUUID();

interface UserPrefsState {
    // Theme and UI
    isDark: boolean;
    toggleTheme: () => void;
    uiZoom: number;
    setUiZoom: (zoom: number) => void;

    // Sidebar and navigation
    isMobileMenuOpen: boolean;
    setMobileMenuOpen: (open: boolean) => void;
    globalSectionOrder: string[];
    setGlobalSectionOrder: (order: string[]) => void;

    // Board presentation preferences
    boardPreferences: Record<string, { viewMode: 'kanban' | 'calendar' | 'list', sortBy: 'default' | 'priority' | 'assignee' | 'dueDate' }>;
    setBoardPreference: (boardId: string, prefs: Partial<{ viewMode: 'kanban' | 'calendar' | 'list', sortBy: 'default' | 'priority' | 'assignee' | 'dueDate' }>) => void;

    // Notifications
    notifications: Notification[];
    addNotification: (title: string, message: string, link?: string) => void;
    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: () => void;
    clearNotifications: () => void;
}

export const useUserPrefsStore = create<UserPrefsState>()(
    persist(
        (set) => ({
            // Theme and UI
            isDark: true,
            toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
            uiZoom: 1,
            setUiZoom: (zoom) => set({ uiZoom: Math.min(Math.max(zoom, 0.5), 2) }),

            // Sidebar and Navigation
            isMobileMenuOpen: false,
            setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
            globalSectionOrder: ['favorites', 'folders', 'recent'],
            setGlobalSectionOrder: (order) => set({ globalSectionOrder: order }),

            // Board preferences
            boardPreferences: {},
            setBoardPreference: (boardId, prefs) => set((s) => ({
                boardPreferences: {
                    ...s.boardPreferences,
                    [boardId]: { ...(s.boardPreferences[boardId] || { viewMode: 'kanban', sortBy: 'default' }), ...prefs }
                }
            })),

            // Notifications
            notifications: [],
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
        }),
        {
            name: 'polaryon-user-prefs', // Key specific for this user/browser
        }
    )
);
