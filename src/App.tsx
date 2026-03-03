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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { cleanupTrash } = useKanbanStore();

  useEffect(() => {
    cleanupTrash();
  }, [cleanupTrash]);

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
