import { useEffect } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { useUserPrefsStore } from '@/store/user-prefs-store';
import { useDocumentStore } from '@/store/document-store';
import { useAuthStore } from '@/store/auth-store';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fixDateToBRT } from "@/lib/utils";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { socketService } from '@/lib/socket';
import LoginPage from "./pages/LoginPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AuditLogPage from "./pages/AuditLogPage";
import OportunidadesSearch from './pages/OportunidadesSearch';
import OportunidadesDashboard from './pages/OportunidadesDashboard';
import DashboardPage from "./pages/DashboardPage";
import FolderPage from "./pages/FolderPage";
import BoardPage from "./pages/BoardPage";
import GlobalCalendarPage from "./pages/GlobalCalendarPage";
import TeamWorkloadPage from "./pages/TeamWorkloadPage";
import SuppliersPage from "./pages/SuppliersPage";
import CompanyListPage from "./pages/CompanyListPage";
import BudgetsPage from "./pages/BudgetsPage";
import CompanyProfilePage from "./pages/CompanyProfilePage";
import DocumentationPage from "./pages/DocumentationPage";
import CapacityCertificatesPage from "./pages/CapacityCertificatesPage";
import EssentialDocumentModelsPage from "./pages/EssentialDocumentModelsPage";
import AccountingDashboard from "./pages/AccountingDashboard";
import AccountingEntries from "./pages/AccountingEntries";
import { CashflowForecastDash } from "./components/accounting/CashflowForecastDash"; // Added import
import KunbunPage from "./pages/KunbunPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

import { useAccountingStore } from '@/store/accounting-store';
import { useEssentialDocumentStore } from '@/store/essential-document-store';
import { useCertificateStore } from '@/store/certificate-store';

const AppContent = () => {
  const { cleanupTrash, cleanOldTrash: cleanKanbanTrash, companies, permanentlyDeleteCompany, updateCompany, fetchKanbanData } = useKanbanStore();
  const { isAuthenticated, currentUser: authUser, setOnlineUsers } = useAuthStore();
  const { uiZoom, isDark } = useUserPrefsStore();
  const { documents, validateDocumentStatuses, cleanOldTrash: cleanDocsTrash } = useDocumentStore();
  const { cleanOldTrash: cleanAccountingTrash } = useAccountingStore();
  const { cleanOldTrash: cleanEssentialDocsTrash } = useEssentialDocumentStore();
  const { cleanOldTrash: cleanCertificateTrash } = useCertificateStore();

  useEffect(() => {
    document.body.style.zoom = uiZoom as any;
  }, [uiZoom]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    const authUser = useAuthStore.getState().currentUser;
    if (authUser) {
      useUserPrefsStore.getState().loadPreferences(authUser.id);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    cleanupTrash();
    cleanKanbanTrash();
    cleanDocsTrash();
    cleanAccountingTrash();
    cleanEssentialDocsTrash();
    cleanCertificateTrash();

    // Trigger local-to-server sync for docs and certs
    useDocumentStore.getState().syncLocalDataToServer().catch(console.error);
    useCertificateStore.getState().syncLocalDataToServer().catch(console.error);
    useAccountingStore.getState().syncLocalDataToServer().catch(console.error);

    fetchKanbanData();
  }, [isAuthenticated, cleanupTrash, cleanKanbanTrash, cleanDocsTrash, cleanAccountingTrash, cleanEssentialDocsTrash, cleanCertificateTrash, fetchKanbanData]);

  // Real-time Presence Monitor
  useEffect(() => {
    if (!isAuthenticated || !authUser) return;

    const handleOnlineUsers = (userIds: string[]) => {
      setOnlineUsers(userIds);
    };

    // Small delay to ensure socket has time to connect (if not already)
    const timeout = setTimeout(() => {
        socketService.emit('user_join', authUser.id);
        socketService.on('online_users', handleOnlineUsers);
    }, 1000);

    return () => {
      clearTimeout(timeout);
      socketService.off('online_users', handleOnlineUsers);
    };
  }, [isAuthenticated, authUser, setOnlineUsers]);


  // Background CNPJ Monitor - Checks status every 7 days
  useEffect(() => {
    const CHECK_INTERVAL = 60000; // Check one company every minute to be very gentle
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    const monitorInterval = setInterval(async () => {
      const store = useKanbanStore.getState();

      // Find one company that hasn't been checked in 7 days
      const now = new Date();
      const needsCheck = store.companies.find(c => {
        if (!c.lastCnpjCheck) return true;
        const lastCheck = new Date(c.lastCnpjCheck);
        return (now.getTime() - lastCheck.getTime()) > SEVEN_DAYS;
      });

      if (needsCheck) {
        try {
          const cleanCnpj = needsCheck.cnpj.replace(/\D/g, '');
          if (cleanCnpj.length === 14) {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
            if (response.ok) {
              const data = await response.json();
              const invalidStatuses = ['BAIXADA', 'INAPTA', 'SUSPENSA', 'NULA'];
              const currentStatus = data.descricao_situacao_cadastral?.toUpperCase();

              if (invalidStatuses.includes(currentStatus)) {
                // UPDATE status but DONT delete automatically (user requested alert/warning)
                store.updateCompany(needsCheck.id, { 
                  descricao_situacao_cadastral: currentStatus,
                  lastCnpjCheck: new Date().toISOString() 
                });
                
                useKanbanStore.getState().addNotification(
                  '⚠️ ALERTA: Empresa Inativa Detectada',
                  `O CNPJ ${needsCheck.cnpj} (${needsCheck.nome_fantasia || needsCheck.razao_social}) consta agora como "${currentStatus}" na Receita Federal. Recomendamos a exclusão manual deste contato.`,
                  `/suppliers-list?id=${needsCheck.id}`,
                  'warning'
                );
              } else {
                // Otherwise, just timestamp it to prevent re-checking for 7 days
                store.updateCompany(needsCheck.id, { 
                  descricao_situacao_cadastral: currentStatus || needsCheck.descricao_situacao_cadastral,
                  lastCnpjCheck: new Date().toISOString() 
                });
              }
            } else if (response.status === 404) {
                // CNPJ not found anymore?
                useKanbanStore.getState().addNotification(
                  '⚠️ ALERTA: CNPJ Não Encontrado',
                  `O CNPJ ${needsCheck.cnpj} (${needsCheck.nome_fantasia || needsCheck.razao_social}) não foi retornado pela API. Verifique a validade deste contato.`,
                  undefined,
                  'warning'
                );
                store.updateCompany(needsCheck.id, { lastCnpjCheck: new Date().toISOString() });
            } else {
              // Rate limit or API error, skip for now but mark as checked to circle through others
              // store.updateCompany(needsCheck.id, { lastCnpjCheck: new Date().toISOString() });
            }
          }
        } catch (error) {
          console.error("CNPJ Background Check failed", error);
        }
      }
    }, CHECK_INTERVAL);

    return () => clearInterval(monitorInterval);
  }, []); // Run only once

  // Initialize Kanban Store data (e.g., fetch from API if not local)
  useEffect(() => {
    // This runs once when the app mounts
    // Placeholder for actual data initialization
    useKanbanStore.getState();
    useAccountingStore.getState().generateRecurringExpenses();
  }, []);

  // Document Expiration Monitor
  useEffect(() => {
    // Run validation on load and then periodically
    useDocumentStore.getState().validateDocumentStatuses();

    // Check every hour
    const interval = setInterval(() => {
      useDocumentStore.getState().validateDocumentStatuses();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []); // Run only once

  // Background Notification Monitor for Instant Bell Updates
  useEffect(() => {
    const NOTIF_INTERVAL = 10000; // Check every 10 seconds
    const interval = setInterval(() => {
      // Only fetch if logged in
      if (useKanbanStore.getState().members.length > 0) {
        useKanbanStore.getState().fetchNotifications();
      }
    }, NOTIF_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check for expiring documents and notify
    const CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour
    const checkDocs = () => {
      const docStore = useDocumentStore.getState();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      docStore.documents.forEach(doc => {
        if (!doc.expirationDate || doc.trashed) return;

        const expDate = fixDateToBRT(doc.expirationDate);
        if (!expDate) return;

        const target = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
        const diffDays = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Only notify if within thresholds (Exactly 10 days, 5 days, or expired)
        // This prevents spamming notifications every hour
        let notifyKey = -1;
        if (diffDays < 0) notifyKey = 0; // Expired
        else if (diffDays <= 5) notifyKey = 5; // Very soon
        else if (diffDays <= 10) notifyKey = 10; // Threshold reached

        if (notifyKey !== -1 && doc.lastNotifiedIndex !== notifyKey) {
          const isExpired = diffDays < 0;
          useKanbanStore.getState().addNotification(
            isExpired ? 'Documento Expirado' : 'Documento Vencendo Próximo',
            `O documento "${doc.title}" ${isExpired ? 'expirou em' : 'vencerá em'} ${target.toLocaleDateString('pt-BR')}.`,
            '/documentacao'
          );
          docStore.updateDocument(doc.id, { lastNotifiedIndex: notifyKey });
        }
      });
    };

    checkDocs(); // initial check
    const docInterval = setInterval(checkDocs, CHECK_INTERVAL);
    return () => clearInterval(docInterval);
  }, []); // Run only once

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      {/* Protected Routes Wrapper */}
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/kunbun" element={<ProtectedRoute><KunbunPage /></ProtectedRoute>} />
      <Route path="/folder/:folderId" element={<ProtectedRoute><FolderPage /></ProtectedRoute>} />
      <Route path="/board/:boardId" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
      <Route path="/oportunidades" element={<ProtectedRoute><OportunidadesDashboard /></ProtectedRoute>} />
      <Route path="/oportunidades/busca" element={<ProtectedRoute><OportunidadesSearch /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><GlobalCalendarPage /></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><TeamWorkloadPage /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
      <Route path="/suppliers-list" element={<ProtectedRoute><CompanyListPage type="Fornecedor" /></ProtectedRoute>} />
      <Route path="/transporters-list" element={<ProtectedRoute><CompanyListPage type="Transportadora" /></ProtectedRoute>} />
      <Route path="/budgets" element={<ProtectedRoute><BudgetsPage /></ProtectedRoute>} />
      <Route path="/company" element={<ProtectedRoute><CompanyProfilePage /></ProtectedRoute>} />
      <Route path="/documentacao" element={<ProtectedRoute><DocumentationPage /></ProtectedRoute>} />
      <Route path="/documentacao/atestados" element={<ProtectedRoute><CapacityCertificatesPage /></ProtectedRoute>} />
      <Route path="/documentacao/modelos" element={<ProtectedRoute><EssentialDocumentModelsPage /></ProtectedRoute>} />
      <Route path="/contabil" element={<ProtectedRoute><AccountingDashboard /></ProtectedRoute>} />
      <Route path="/contabil/lancamentos" element={<ProtectedRoute><AccountingEntries /></ProtectedRoute>} />
      <Route path="/contabil/fluxo-caixa" element={<ProtectedRoute><CashflowForecastDash /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
      <Route path="/admin/audit" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "38947932-asdgasdf.apps.googleusercontent.com"}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;
