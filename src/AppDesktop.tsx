import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import UpdateNotification from '@/components/layout/UpdateNotification';

// IMPORTAÇÃO ESTÁTICA - Essencial para evitar falha de chunks no Electron file://
import DesktopCombatTerminal from "./pages/DesktopCombatTerminal";
import LoginPage from "./pages/LoginPage";

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
        console.log("[POLARYON] Sistema Operacional Iniciado.");
        
        // Desarma o alarme de segurança (A carga foi um sucesso!)
        if ((window as any).WATCHDOG_TIMER) {
            clearTimeout((window as any).WATCHDOG_TIMER);
        }

        document.documentElement.classList.add('dark');
        document.body.classList.add('bg-[#020817]');
        document.body.style.overflow = 'hidden';
    }, []);

    return (
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
    );
};

const AppDesktop = () => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <Toaster />
            <Sonner position="top-right" theme="dark" />
            <HashRouter>
                <UpdateNotification />
                <AppDesktopContent />
            </HashRouter>
        </TooltipProvider>
    </QueryClientProvider>
);

export default AppDesktop;
