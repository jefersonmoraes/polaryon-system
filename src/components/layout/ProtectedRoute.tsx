import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
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
        } else if (currentUser?.status === 'disabled') {
            useAuthStore.getState().logout();
            navigate('/login', { replace: true });
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
