import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { useKanbanStore } from '@/store/kanban-store';
import AppHeader from '@/components/layout/AppHeader';
import AppSidebar from '@/components/layout/AppSidebar';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, currentUser } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login', { replace: true, state: { from: location.pathname } });
            return;
        }

        if (currentUser?.status === 'disabled' || currentUser?.status === 'invited') {
            useAuthStore.getState().logout();
            navigate('/login', { replace: true });
            return;
        }

        const role = currentUser?.role;
        const p = location.pathname;
        const hasScreenAccess = useAuthStore.getState().hasScreenAccess;

        // Forced routes for accountants bypassing normal checks if no specific access is granted
        if (role === 'CONTADOR' && !hasScreenAccess('DOCUMENTATION') && !hasScreenAccess('SUPPLIERS')) {
            if (!p.startsWith('/contabil')) {
                navigate('/contabil?tab=exportacao', { replace: true });
            }
            return;
        }

        // Module checks
        const accessMap: Record<string, string> = {
            '/suppliers': 'SUPPLIERS',
            '/suppliers-list': 'SUPPLIERS',
            '/transporters-list': 'SUPPLIERS',
            '/documentacao': 'DOCUMENTATION',
            '/oportunidades': 'OPORTUNIDADES',
            '/kunbun': 'KUNBUN',
            '/folder': 'KUNBUN',
            '/board': 'KUNBUN',
            '/calendar': 'CALENDAR',
            '/team': 'TEAM',
            '/contabil': 'ACCOUNTING'
        };

        const requiredScreen = Object.keys(accessMap).find(prefix => p.startsWith(prefix))
            ? accessMap[Object.keys(accessMap).find(prefix => p.startsWith(prefix))!]
            : null;

        if (requiredScreen && !hasScreenAccess(requiredScreen)) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, currentUser, navigate, location]);

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-background">
            <AppHeader />
            <div className="flex flex-1 overflow-hidden">
                <AppSidebar />
                <main className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar">
                    {children}
                </main>
            </div>
        </div>
    );
};
