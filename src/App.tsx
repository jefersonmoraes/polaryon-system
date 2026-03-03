import { useEffect } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import DashboardPage from "./pages/DashboardPage";
import FolderPage from "./pages/FolderPage";
import BoardPage from "./pages/BoardPage";
import GlobalCalendarPage from "./pages/GlobalCalendarPage";
import TeamWorkloadPage from "./pages/TeamWorkloadPage";
import SuppliersPage from "./pages/SuppliersPage";
import CompanyListPage from "./pages/CompanyListPage";
import BudgetsPage from "./pages/BudgetsPage";
import CompanyProfilePage from "./pages/CompanyProfilePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { cleanupTrash, companies, permanentlyDeleteCompany, updateCompany, addNotification } = useKanbanStore();

  useEffect(() => {
    cleanupTrash();
  }, [cleanupTrash]);

  // Background CNPJ Monitor
  useEffect(() => {
    const CHECK_INTERVAL = 30000; // Check every 30 seconds to not overwhelm the API
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    const monitorInterval = setInterval(async () => {
      // Find one company that hasn't been checked in 24 hours
      const now = new Date();
      const needsCheck = companies.find(c => {
        if (!c.lastCnpjCheck) return true;
        const lastCheck = new Date(c.lastCnpjCheck);
        return (now.getTime() - lastCheck.getTime()) > TWENTY_FOUR_HOURS;
      });

      if (needsCheck) {
        try {
          const cleanCnpj = needsCheck.cnpj.replace(/\D/g, '');
          if (cleanCnpj.length === 14) {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
            if (response.ok) {
              const data = await response.json();
              const invalidStatuses = ['BAIXADA', 'INAPTA', 'SUSPENSA', 'NULA'];

              if (invalidStatuses.includes(data.descricao_situacao_cadastral?.toUpperCase())) {
                // If the status became invalid, delete it and notify the user
                permanentlyDeleteCompany(needsCheck.id);
                addNotification(
                  'Empresa Removida Automaticamente',
                  `O CNPJ ${needsCheck.cnpj} (${needsCheck.nome_fantasia || needsCheck.razao_social}) foi excluído do sistema pois a situação cadastral na Receita consta como "${data.descricao_situacao_cadastral}".`
                );
              } else {
                // Otherwise, just timestamp it to prevent re-checking for 24h
                updateCompany(needsCheck.id, { lastCnpjCheck: new Date().toISOString() });
              }
            } else {
              // API might be down or rate limited, let's just mark it checked so we move to the next
              updateCompany(needsCheck.id, { lastCnpjCheck: new Date().toISOString() });
            }
          }
        } catch (error) {
          console.error("CNPJ Background Check failed", error);
        }
      }
    }, CHECK_INTERVAL);

    return () => clearInterval(monitorInterval);
  }, [companies, permanentlyDeleteCompany, updateCompany, addNotification]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/folder/:folderId" element={<FolderPage />} />
          <Route path="/board/:boardId" element={<BoardPage />} />
          <Route path="/calendar" element={<GlobalCalendarPage />} />
          <Route path="/team" element={<TeamWorkloadPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/suppliers-list" element={<CompanyListPage type="Fornecedor" />} />
          <Route path="/transporters-list" element={<CompanyListPage type="Transportadora" />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/company" element={<CompanyProfilePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
