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
            // Redirect to login if trying to access a protected route
            navigate('/login', { replace: true, state: { from: location.pathname } });
        } else if (currentUser?.status === 'disabled') {
            // If the user was disabled by an admin while logged in
            useAuthStore.getState().logout();
            navigate('/login', { replace: true });
        }
    }, [isAuthenticated, currentUser, navigate, location]);

    if (!isAuthenticated) {
        return null; // Will redirect in useEffect
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            <AppHeader />
            <div className="flex flex-1 overflow-hidden">
                <AppSidebar />
                <div className="flex-1 overflow-auto bg-background relative">
                    {children}
                </div>
            </div>
        </div>
    );
};
