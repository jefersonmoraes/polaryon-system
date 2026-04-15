import { useEffect, useRef, lazy, Suspense } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { useUserPrefsStore } from '@/store/user-prefs-store';
import { useDocumentStore } from '@/store/document-store';
import { useAuthStore } from '@/store/auth-store';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "@/components/ui/sonner";
import { useToast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fixDateToBRT } from "@/lib/utils";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from '@/components/ui/sidebar';
import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import UpdateNotification from '@/components/layout/UpdateNotification';
import api from '@/lib/api';
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { socketService } from '@/lib/socket';
import LoginPage from "./pages/LoginPage";
import { useAccountingStore } from '@/store/accounting-store';
import { useEssentialDocumentStore } from '@/store/essential-document-store';
import { useCertificateStore } from '@/store/certificate-store';

// Lazy Loading V5.1 Turbo
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));
const OportunidadesSearch = lazy(() => import("./pages/OportunidadesSearch"));
const InteligenciaPreditiva = lazy(() => import("./pages/InteligenciaPreditiva"));
const OportunidadesDashboard = lazy(() => import("./pages/OportunidadesDashboard"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const FolderPage = lazy(() => import("./pages/FolderPage"));
const BoardPage = lazy(() => import("./pages/BoardPage"));
const GlobalCalendarPage = lazy(() => import("./pages/GlobalCalendarPage"));
const TeamWorkloadPage = lazy(() => import("./pages/TeamWorkloadPage"));
const SuppliersPage = lazy(() => import("./pages/SuppliersPage"));
const CompanyListPage = lazy(() => import("./pages/CompanyListPage"));
const BudgetsPage = lazy(() => import("./pages/BudgetsPage"));
const CompanyProfilePage = lazy(() => import("./pages/CompanyProfilePage"));
const DocumentationPage = lazy(() => import("./pages/DocumentationPage"));
const CapacityCertificatesPage = lazy(() => import("./pages/CapacityCertificatesPage"));
const EssentialDocumentModelsPage = lazy(() => import("./pages/EssentialDocumentModelsPage"));
const AccountingDashboard = lazy(() => import("./pages/AccountingDashboard"));
const AccountingEntries = lazy(() => import("./pages/AccountingEntries"));
const KanbanPage = lazy(() => import("./pages/KanbanPage"));
const ConnectionPage = lazy(() => import("./pages/ConnectionPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const TransparencySearchPage = lazy(() => import("./pages/TransparencySearchPage"));
const BiddingDashboardPage = lazy(() => import("./pages/BiddingDashboardPage"));
const RadarScannerPage = lazy(() => import("./pages/RadarScannerPage"));
const TrashPage = lazy(() => import("./pages/TrashPage"));
const BackupsPage = lazy(() => import("./pages/BackupsPage"));
const DesktopDownloadPage = lazy(() => import("./pages/DesktopDownloadPage"));
const SecretVaultPage = lazy(() => import("./pages/SecretVaultPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Heavy component split-out
const CashflowForecastDash = lazy(() => import("./components/accounting/CashflowForecastDash"));

const queryClient = new QueryClient();

const AppContent = () => {
  const fetchKanbanData = useKanbanStore(state => state.fetchKanbanData);
  const cleanupTrash = useKanbanStore(state => state.cleanupTrash);
  const cleanKanbanTrash = useKanbanStore(state => state.cleanOldTrash);
  const companies = useKanbanStore(state => state.companies);

  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const authUser = useAuthStore(state => state.currentUser);
  const setOnlineUsers = useAuthStore(state => state.setOnlineUsers);
  const setSocketConnected = useAuthStore(state => state.setSocketConnected);

  const uiZoom = useUserPrefsStore(state => state.uiZoom);
  const isDark = useUserPrefsStore(state => state.isDark);

  const cleanDocsTrash = useDocumentStore(state => state.cleanOldTrash);
  const validateDocumentStatuses = useDocumentStore(state => state.validateDocumentStatuses);
  const documents = useDocumentStore(state => state.documents);

  const cleanAccountingTrash = useAccountingStore(state => state.cleanOldTrash);
  const cleanEssentialDocsTrash = useEssentialDocumentStore(state => state.cleanOldTrash);
  const cleanCertificateTrash = useCertificateStore(state => state.cleanOldTrash);
  
  // Defensive ref for presence notifications (Industrial-grade shielding)
  const lastNotificationTimes = useRef<Record<string, number>>({});

  useEffect(() => {
    document.body.style.zoom = uiZoom as any;

    // Handle Vite dynamic import errors (Mismatch of hashes after new builds)
    const handlePreloadError = (event: Event) => {
      console.log('Preload error detected, reloading page...', event);
      window.location.reload();
    };

    window.addEventListener('vite:preloadError', handlePreloadError);
    return () => window.removeEventListener('vite:preloadError', handlePreloadError);
  }, [uiZoom]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (authUser) {
      useUserPrefsStore.getState().loadPreferences(authUser.id);
    }
  }, [authUser]);

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
  }, [isAuthenticated, fetchKanbanData]);

  // Real-time Presence and Connection Monitor
  useEffect(() => {
    if (!isAuthenticated || !authUser) return;

    const playPresenceSound = (type: 'connect' | 'disconnect') => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            if (type === 'connect') {
                oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
                oscillator.frequency.exponentialRampToValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
            } else {
                oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime); 
                oscillator.frequency.exponentialRampToValueAtTime(523.25, audioContext.currentTime + 0.1);
            }

            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            // Silently fail if audio is blocked or unsupported
        }
    };

    const handleOnlineUsers = (ids: string[]) => {
        setOnlineUsers(ids);
    };

    const handleConnectionChange = (connected: boolean) => {
        setSocketConnected(connected);
        if (connected && authUser) {
            socketService.emit('user_join', {
                id: authUser.id,
                name: authUser.name,
                picture: authUser.photoURL
            });
        } else {
            setOnlineUsers([]);
        }
    };

    const handlePresenceConnect = (user: { id: string, name: string, picture?: string }) => {
        try {
            if (!user.id || user.id === authUser.id) return;
            
            // Cooldown de 2s para evitar flood de notificações
            const now = Date.now();
            const lastTime = lastNotificationTimes.current[user.id] || 0;
            if (now - lastTime < 2000) return;
            lastNotificationTimes.current[user.id] = now;

            playPresenceSound('connect');
            toast.success(
                <div className="flex items-center gap-3 max-w-[280px]">
                    {user.picture && (
                        <div className="w-10 h-10 flex-shrink-0">
                            <img src={user.picture} className="w-full h-full rounded-full object-cover border-2 border-emerald-500 shadow-sm" alt="" />
                        </div>
                    )}
                    <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm truncate">{user.name} entrou</span>
                        <span className="text-xs opacity-70">Online agora</span>
                    </div>
                </div>,
                { duration: 5000 }
            );
        } catch (error) {
            console.error("Error in handlePresenceConnect:", error);
        }
    };

    const handlePresenceDisconnect = (user: { id: string, name: string, picture?: string }) => {
        try {
            if (!user.id || user.id === authUser.id) return;
            
            const now = Date.now();
            const lastTime = lastNotificationTimes.current[user.id] || 0;
            if (now - lastTime < 2000) return;
            lastNotificationTimes.current[user.id] = now;

            playPresenceSound('disconnect');
            toast.info(
                <div className="flex items-center gap-3 max-w-[280px]">
                    {user.picture && (
                        <div className="w-10 h-10 flex-shrink-0">
                            <img src={user.picture} className="w-full h-full rounded-full object-cover opacity-60 grayscale border-2 border-slate-400" alt="" />
                        </div>
                    )}
                    <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm truncate">{user.name} saiu</span>
                        <span className="text-xs opacity-70">Desconectado</span>
                    </div>
                </div>,
                { duration: 5000 }
            );
        } catch (error) {
            console.error("Error in handlePresenceDisconnect:", error);
        }
    };

    const identifyUser = () => {
        if (isAuthenticated && authUser?.id) {
            socketService.emit('user_join', {
                id: authUser.id,
                name: authUser.name,
                picture: authUser.photoURL
            });
        }
    };

    const handleReconnect = () => identifyUser();

    socketService.on('online_users', handleOnlineUsers);
    socketService.on('connection_change', handleConnectionChange);
    socketService.on('user_presence_connect', handlePresenceConnect);
    socketService.on('user_presence_disconnect', handlePresenceDisconnect);
    socketService.on('connect', handleReconnect);

    identifyUser();

    return () => {
      socketService.off('online_users', handleOnlineUsers);
      socketService.off('connection_change', handleConnectionChange);
      socketService.off('user_presence_connect', handlePresenceConnect);
      socketService.off('user_presence_disconnect', handlePresenceDisconnect);
      socketService.off('connect', handleReconnect);
    };
  }, [isAuthenticated, authUser, setOnlineUsers, setSocketConnected]);

  // Global Activity Heartbeat - INDEPENDENT HOOK (V7.0.3 Fix)
  useEffect(() => {
    if (!isAuthenticated || !authUser) return;

    const sendHeartbeat = () => {
      if (document.visibilityState === 'visible') {
        socketService.emit('user_heartbeat', { userId: authUser.id });
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, authUser]);

  // Background CNPJ Monitor - Checks status every 7 days
  useEffect(() => {
    const CHECK_INTERVAL = 60000;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    const monitorInterval = setInterval(async () => {
      const store = useKanbanStore.getState();
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
                store.updateCompany(needsCheck.id, { 
                  descricao_situacao_cadastral: currentStatus,
                  lastCnpjCheck: new Date().toISOString() 
                });
                
                useKanbanStore.getState().addNotification(
                  '⚠️ ALERTA: Empresa Inativa Detectada',
                  `O CNPJ ${needsCheck.cnpj} (${needsCheck.nome_fantasia || needsCheck.razao_social}) consta agora como "${currentStatus}" na Receita Federal.`,
                  `/suppliers-list?id=${needsCheck.id}`,
                  'warning'
                );
              } else {
                store.updateCompany(needsCheck.id, { 
                  descricao_situacao_cadastral: currentStatus || needsCheck.descricao_situacao_cadastral,
                  lastCnpjCheck: new Date().toISOString() 
                });
              }
            } else if (response.status === 404) {
                useKanbanStore.getState().addNotification(
                  '⚠️ ALERTA: CNPJ Não Encontrado',
                  `O CNPJ ${needsCheck.cnpj} não foi retornado pela API.`,
                  undefined,
                  'warning'
                );
                store.updateCompany(needsCheck.id, { lastCnpjCheck: new Date().toISOString() });
            }
          }
        } catch (error) {
          console.error("CNPJ Background Check failed", error);
        }
      }
    }, CHECK_INTERVAL);

    return () => clearInterval(monitorInterval);
  }, []);

  useEffect(() => {
    useKanbanStore.getState();
    useAccountingStore.getState().generateRecurringExpenses();
  }, []);

  useEffect(() => {
    useDocumentStore.getState().validateDocumentStatuses();
    const interval = setInterval(() => {
      useDocumentStore.getState().validateDocumentStatuses();
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const NOTIF_INTERVAL = 30000; // Aumentado de 10s para 30s para evitar 429
    const interval = setInterval(() => {
      if (useKanbanStore.getState().members.length > 0) {
        useKanbanStore.getState().fetchNotifications();
      }
    }, NOTIF_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const CHECK_INTERVAL = 60 * 60 * 1000;
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
        let notifyKey = -1;
        if (diffDays < 0) notifyKey = 0;
        else if (diffDays <= 5) notifyKey = 5;
        else if (diffDays <= 10) notifyKey = 10;

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
    checkDocs();
    const docInterval = setInterval(checkDocs, CHECK_INTERVAL);
    return () => clearInterval(docInterval);
  }, []);

  return (
    <Suspense fallback={
        <div className="flex h-screen w-full items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-lg text-primary"></div>
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Polaryon está carregando...</p>
            </div>
        </div>
    }>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/tarefas" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/kanban" element={<ProtectedRoute><KanbanPage /></ProtectedRoute>} />
      <Route path="/folder/:folderId" element={<ProtectedRoute><FolderPage /></ProtectedRoute>} />
      <Route path="/board/:boardId" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
      <Route path="/oportunidades" element={<ProtectedRoute><OportunidadesDashboard /></ProtectedRoute>} />
      <Route path="/oportunidades/busca" element={<ProtectedRoute><OportunidadesSearch /></ProtectedRoute>} />
      <Route path="/oportunidades/radar" element={<ProtectedRoute><RadarScannerPage /></ProtectedRoute>} />
      <Route path="/oportunidades/preditivo" element={<ProtectedRoute><InteligenciaPreditiva /></ProtectedRoute>} />
      <Route 
        path="/robo-lances" 
        element={
          <ProtectedRoute>
            {typeof window !== 'undefined' && (!!(window as any).electronAPI?.isDesktop || navigator.userAgent.toLowerCase().includes('electron'))
              ? <BiddingDashboardPage /> 
              : <Navigate to="/desktop" replace />
            }
          </ProtectedRoute>
        } 
      />
      <Route path="/transparencia" element={<ProtectedRoute><TransparencySearchPage /></ProtectedRoute>} />
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
      <Route path="/admin/backups" element={<ProtectedRoute><BackupsPage /></ProtectedRoute>} />
      <Route path="/desktop" element={<ProtectedRoute><DesktopDownloadPage /></ProtectedRoute>} />
      <Route path="/lixeira" element={<ProtectedRoute><TrashPage /></ProtectedRoute>} />
      <Route path="/conexao" element={<ProtectedRoute><ConnectionPage /></ProtectedRoute>} />
      <Route path="/seguranca/cofre" element={<ProtectedRoute><SecretVaultPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
};

const App = () => (
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "38947932-asdgasdf.apps.googleusercontent.com"}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ConnectionBanner />
          <UpdateNotification />
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;
