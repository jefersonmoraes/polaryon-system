import { useEffect, Suspense, lazy } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import UpdateNotification from '@/components/layout/UpdateNotification';

// Carregamento exclusivo das páginas de combate
const DesktopCombatTerminal = lazy(() => import("./pages/DesktopCombatTerminal"));
const LoginPage = lazy(() => import("./pages/LoginPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false
    }
  }
});

const AppDesktopContent = () => {
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);

    // No desktop, forçamos o tema dark para estética de terminal
    useEffect(() => {
        document.documentElement.classList.add('dark');
        document.body.classList.add('bg-[#020817]');
        // Remove barras de rolagem globais para um look de "App Nativo"
        document.body.style.overflow = 'hidden';
    }, []);

    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-[#020817]">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                    <p className="text-xs font-mono text-emerald-500 animate-pulse uppercase tracking-widest">Iniciando Terminal Polaryon...</p>
                </div>
            </div>
        }>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route 
                    path="*" 
                    element={
                        isAuthenticated 
                            ? <DesktopCombatTerminal /> 
                            : <Navigate to="/login" replace />
                    } 
                />
            </Routes>
        </Suspense>
    );
};

const AppDesktop = () => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <Toaster />
            <Sonner position="top-right" theme="dark" />
            <BrowserRouter>
                <UpdateNotification />
                <AppDesktopContent />
            </BrowserRouter>
        </TooltipProvider>
    </QueryClientProvider>
);

export default AppDesktop;
