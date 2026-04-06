import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const uid = () => crypto.randomUUID();

interface UserPrefsData {
    // Theme and UI
    isDark: boolean;
    uiZoom: number;

    // Sidebar and navigation
    isMobileMenuOpen: boolean;
    globalSectionOrder: string[];

    // Board presentation preferences
    boardPreferences: Record<string, { viewMode: 'kanban' | 'calendar' | 'list', sortBy: 'default' | 'priority' | 'assignee' | 'dueDate' }>;
}

const defaultPrefs: UserPrefsData = {
    isDark: true,
    uiZoom: 1,
    isMobileMenuOpen: false,
    globalSectionOrder: ['favorites', 'folders', 'recent'],
    boardPreferences: {}
};

interface UserPrefsState extends UserPrefsData {
    currentUserId: string | null;

    // Actions
    loadPreferences: (userId: string) => void;
    toggleTheme: () => void;
    setUiZoom: (zoom: number) => void;
    setMobileMenuOpen: (open: boolean) => void;
    setGlobalSectionOrder: (order: string[]) => void;
    setBoardPreference: (boardId: string, prefs: Partial<{ viewMode: 'kanban' | 'calendar' | 'list', sortBy: 'default' | 'priority' | 'assignee' | 'dueDate' }>) => void;
}

const saveToLocal = (userId: string, data: Partial<UserPrefsData>) => {
    if (!userId) return;
    const key = `polaryon-prefs-${userId}`;
    try {
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        localStorage.setItem(key, JSON.stringify({ ...existing, ...data }));
    } catch (e) {
        console.warn(`[UserPrefs] Failed to save preferences for user ${userId} to localStorage:`, e);
    }
};

export const useUserPrefsStore = create<UserPrefsState>()((set, get) => ({
    ...defaultPrefs,
    currentUserId: null,

    loadPreferences: (userId: string) => {
        const key = `polaryon-prefs-${userId}`;
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        set({ ...defaultPrefs, ...saved, currentUserId: userId });
        
        // Apply theme immediately
        if (saved.isDark !== undefined ? saved.isDark : defaultPrefs.isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        // Apply zoom immediately
        document.body.style.zoom = (saved.uiZoom !== undefined ? saved.uiZoom : defaultPrefs.uiZoom) as any;
    },

    toggleTheme: () => {
        const { currentUserId, isDark } = get();
        const newDark = !isDark;
        set({ isDark: newDark });
        if (currentUserId) saveToLocal(currentUserId, { isDark: newDark });
    },

    setUiZoom: (zoom) => {
        const { currentUserId } = get();
        const newZoom = Math.min(Math.max(zoom, 0.5), 2);
        set({ uiZoom: newZoom });
        if (currentUserId) saveToLocal(currentUserId, { uiZoom: newZoom });
    },

    setMobileMenuOpen: (open) => {
        const { currentUserId } = get();
        set({ isMobileMenuOpen: open });
        if (currentUserId) saveToLocal(currentUserId, { isMobileMenuOpen: open });
    },

    setGlobalSectionOrder: (order) => {
        const { currentUserId } = get();
        set({ globalSectionOrder: order });
        if (currentUserId) saveToLocal(currentUserId, { globalSectionOrder: order });
    },

    setBoardPreference: (boardId, prefs) => {
        const { currentUserId, boardPreferences } = get();
        const newPrefs = {
            ...boardPreferences,
            [boardId]: { ...(boardPreferences[boardId] || { viewMode: 'kanban', sortBy: 'default' }), ...prefs }
        };
        set({ boardPreferences: newPrefs });
        if (currentUserId) saveToLocal(currentUserId, { boardPreferences: newPrefs });
    },
}));
