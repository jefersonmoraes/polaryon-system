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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="h-screen flex flex-col overflow-hidden">
          <AppHeader />
          <div className="flex flex-1 overflow-hidden">
            <AppSidebar />
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/folder/:folderId" element={<FolderPage />} />
              <Route path="/board/:boardId" element={<BoardPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
