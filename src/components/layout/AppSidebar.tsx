import { Link, useLocation } from 'react-router-dom';
import { useKanbanStore } from '@/store/kanban-store';
import { useUserPrefsStore } from '@/store/user-prefs-store';
import { useAuthStore } from '@/store/auth-store';
import { useSidebarLinkStore } from '@/store/sidebar-link-store';
import { useConnectionStore, ConnectionFolder } from '@/store/connection-store';
import SidebarLinkDialog from './SidebarLinkDialog';
import { useState, useEffect } from 'react';
import { FolderOpen, Plus, ChevronRight, ChevronLeft, LayoutGrid, Calendar, Users, Building2, Truck, Briefcase, MapPin, Calculator, FileText, PiggyBank, LayoutDashboard, FileBarChart, ArrowLeftRight, Activity, ShieldAlert, Target, Trash2, Star, MoreVertical, Edit2, FolderPlus, Zap, TrendingUp, Radar, MonitorDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Database } from 'lucide-react';

const AppSidebar = () => {
  const { mainCompanies } = useKanbanStore();
  const { isMobileMenuOpen, setMobileMenuOpen } = useUserPrefsStore();
  const { currentUser, hasScreenAccess } = useAuthStore();
  const { links, fetchLinks, deleteLink } = useSidebarLinkStore();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  
  const [currencyQuotes, setCurrencyQuotes] = useState<{ usd: string; eur: string } | null>(null);

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const response = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL');
        const data = await response.json();
        setCurrencyQuotes({
          usd: parseFloat(data.USDBRL.bid).toFixed(2),
          eur: parseFloat(data.EURBRL.bid).toFixed(2)
        });
      } catch (error) {
        console.error('Error fetching currency quotes:', error);
      }
    };
    fetchQuotes();
    // Update every 10 minutes
    const interval = setInterval(fetchQuotes, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search, setMobileMenuOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen, setMobileMenuOpen]);

  const isCompanyModule = location.pathname.startsWith('/suppliers') || location.pathname.startsWith('/transporters');
  const isBudgetModule = location.pathname.startsWith('/budgets');
  const isDocsModule = location.pathname.startsWith('/documentacao');
  const isAdminModule = location.pathname.startsWith('/company') || location.pathname.startsWith('/admin');
  const isAccountingModule = location.pathname.startsWith('/contabil');
  const isOportunidadesModule = location.pathname.startsWith('/oportunidades') || location.pathname.startsWith('/transparencia');
  const isConnectionModule = location.pathname.startsWith('/conexao');

  useEffect(() => {
    if (isDocsModule) {
      fetchLinks('DOCUMENTATION');
    }
  }, [isDocsModule]);

  const { boards, folders } = useKanbanStore();
  const isKanbanModule = location.pathname.startsWith('/folder/') || location.pathname.startsWith('/board/');
  let kanbanFolderId = null;
  if (isKanbanModule) {
    if (location.pathname.startsWith('/folder/')) {
      kanbanFolderId = location.pathname.split('/')[2];
    } else if (location.pathname.startsWith('/board/')) {
      const boardId = location.pathname.split('/')[2];
      const board = boards.find(b => b.id === boardId && !b.trashed && !b.archived);
      if (board) kanbanFolderId = board.folderId;
    }
  }
  const activeKanbanFolder = folders.find(f => f.id === kanbanFolderId && !f.trashed && !f.archived);
  const activeKanbanBoards = boards.filter(b => b.folderId === kanbanFolderId && !b.trashed && !b.archived).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  // Connection module logic
  const { folders: connectionFolders, fetchFolders } = useConnectionStore();
  
  // Effect to load connections when module is active
  useEffect(() => {
    if (isConnectionModule) {
      fetchFolders(false);
    }
  }, [isConnectionModule]);

  const renderConnectionFolders = (parentId: string | null = null, level = 0) => {
    return connectionFolders
      .filter(f => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(folder => (
        <div key={folder.id} className="flex flex-col">
          <div className="group flex items-center gap-1 pr-2">
            <Link
              to={`/conexao?folder=${folder.id}`}
              className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${location.search.includes(`folder=${folder.id}`) ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}
              style={{ paddingLeft: `${(level * 12) + 8}px` }}
              title={folder.name}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="truncate">{folder.name}</span>
            </Link>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent rounded-md transition-all text-sidebar-foreground/50">
                  <MoreVertical className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => useConnectionStore.getState().setFolderDialogOpen(true, folder)} className="gap-2">
                  <Edit2 className="h-3.5 w-3.5" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => useConnectionStore.getState().trashFolder(folder.id)} className="text-destructive gap-2">
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => useConnectionStore.getState().setFolderDialogOpen(true, { id: '', name: '', color: '#3b82f6', parentId: folder.id, links: [], createdAt: '', updatedAt: '', order: 0 } as any)} className="gap-2">
                  <FolderPlus className="h-3.5 w-3.5" /> Subpasta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {renderConnectionFolders(folder.id, level + 1)}
        </div>
      ));
  };


  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:relative top-0 left-0 h-full z-[70] md:z-auto
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'w-16' : 'w-64'} 
        shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col 
        overflow-y-auto overflow-x-hidden scrollbar-hide transition-all duration-300 group
      `}>
        <div className="h-16 shrink-0 flex items-center justify-between px-2 border-b border-sidebar-border/50">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex bg-sidebar-accent/50 hover:bg-sidebar-accent border border-sidebar-border rounded-lg p-1.5 shadow-sm transition-all text-sidebar-foreground items-center justify-center w-full max-w-[32px] mx-auto"
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {/* Mobile specific header section inside sidebar */}
          <div className="md:hidden flex items-center justify-between w-full px-2 mt-2">
            <span className="font-bold text-sm tracking-tight">POLARYON</span>
            {!isCollapsed && (
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-muted-foreground hover:bg-sidebar-accent rounded transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {isCompanyModule ? (
            <div className="flex-1 p-3 mt-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                {!isCollapsed && <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Navegação</span>}
                <Link to="/suppliers" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/suppliers' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Pesquisa CNPJ">
                  <Building2 className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Pesquisa CNPJ</span>}
                </Link>
                <Link to="/suppliers-list" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/suppliers-list' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Fornecedores">
                  <Briefcase className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Fornecedores</span>}
                </Link>
                <Link to="/transporters-list" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/transporters-list' && !location.search.includes('tab=routes') ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Transportadoras">
                  <Truck className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Transportadoras</span>}
                </Link>
                <Link to="/transporters-list?tab=routes" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/transporters-list' && location.search.includes('tab=routes') ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Rotas de Atuação">
                  <MapPin className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Rotas de Atuação</span>}
                </Link>
              </div>
            </div>
          ) : isBudgetModule ? (
            <div className="flex-1 p-3 mt-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                {!isCollapsed && <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Finanças</span>}
                <Link to="/budgets" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/budgets' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Todos os Orçamentos">
                  <Calculator className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Todos os Orçamentos</span>}
                </Link>
              </div>
            </div>
          ) : isDocsModule ? (
            <div className="flex-1 p-3 mt-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                {!isCollapsed && <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Documentos Internos</span>}

                {hasScreenAccess('DOCUMENTATION') && (
                  <Link to="/documentacao" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/documentacao' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Gestão de Documentos">
                    <FolderOpen className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Gestão de Documentos</span>}
                  </Link>
                )}

                {hasScreenAccess('DOCUMENTATION') && (
                  <>
                    <Link to="/documentacao/atestados" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/documentacao/atestados' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Atestados de Capacidade Técnica">
                      <Briefcase className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Acervo Técnico</span>}
                    </Link>

                    <Link to="/documentacao/modelos" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/documentacao/modelos' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Modelos de Doc. Essenciais">
                      <FileText className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Modelos de Doc. Essenciais</span>}
                    </Link>
                  </>
                )}
              </div>

            </div>
          ) : isAdminModule ? (
            <div className="flex-1 p-3 mt-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1 text-sidebar-foreground/80">
                {!isCollapsed && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">Administradoras</span>
                  </div>
                )}

                {useAuthStore.getState().currentUser?.role === 'ADMIN' && (
                  <>
                    <Link to="/admin" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors mb-2 ${location.pathname === '/admin' ? 'bg-primary text-primary-foreground font-medium border border-primary text-white shadow-sm' : 'bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive border border-destructive/20'}`} title="Gestão de Acessos">
                      <ShieldAlert className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Gestão de Acessos (Admin)</span>}
                    </Link>
                    <Link to="/admin/audit" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors mb-2 ${location.pathname === '/admin/audit' ? 'bg-primary text-primary-foreground font-medium border border-primary text-white shadow-sm' : 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border border-primary/20'}`} title="Histórico de Ações">
                      <ShieldAlert className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Histórico de Ações</span>}
                    </Link>
                  </>
                )}

                <Link to="/company" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors mb-2 ${location.pathname === '/company' && !location.search.includes('id=') ? 'bg-primary text-primary-foreground font-medium border border-primary text-white shadow-sm' : 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border border-primary/20'}`} title="Nova Administradora">
                  <Plus className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Nova Administradora</span>}
                </Link>

                {useAuthStore.getState().currentUser?.role === 'ADMIN' && (
                  <Link to="/admin/backups" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors mb-2 ${location.pathname === '/admin/backups' ? 'bg-primary text-primary-foreground font-medium border border-primary text-white shadow-sm' : 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border border-primary/20'}`} title="Backups de Segurança">
                    <Database className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Backups de Segurança</span>}
                  </Link>
                )}

                {mainCompanies.map(company => (
                  <Link
                    key={company.id}
                    to={`/company?id=${company.id}`}
                    className={`flex items-center justify-between gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/company' && location.search.includes(`id=${company.id}`) ? 'bg-sidebar-accent text-sidebar-foreground font-medium border border-border' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}
                    title={company.nomeFantasia || company.razaoSocial || 'Administradora'}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className={`h-4 w-4 shrink-0 ${company.isDefault ? 'text-yellow-500' : ''}`} />
                      {!isCollapsed && <span className="truncate">{company.nomeFantasia || company.razaoSocial || 'Sem Nome'}</span>}
                    </div>
                    {!isCollapsed && company.isDefault && (
                      <span className="text-[8px] uppercase font-bold bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded border border-yellow-500/20 shrink-0">Padrão</span>
                    )}
                  </Link>
                ))}

                {mainCompanies.length === 0 && !isCollapsed && (
                  <p className="text-[10px] text-muted-foreground italic px-2 py-4 text-center">Nenhuma administradora cadastrada.</p>
                )}
              </div>
            </div>
          ) : isAccountingModule ? (
            <div className="flex-1 p-3 mt-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                {!isCollapsed && <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Módulo Contábil</span>}

                {useAuthStore.getState().currentUser?.role !== 'CONTADOR' && (
                  <>
                    <Link to="/contabil" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/contabil' && !location.search.includes('tab=exportacao') ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Visão Geral">
                      <LayoutDashboard className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Visão Geral</span>}
                    </Link>

                    <Link to="/contabil/lancamentos" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/contabil/lancamentos' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Entradas e Saídas">
                      <ArrowLeftRight className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Entradas e Saídas</span>}
                    </Link>

                    <Link to="/contabil/fluxo-caixa" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/contabil/fluxo-caixa' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Simulador Fluxo de Caixa">
                      <Activity className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Fluxo de Caixa</span>}
                    </Link>
                  </>
                )}

                <Link to="/contabil?tab=exportacao" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/contabil' && location.search.includes('tab=exportacao') ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'} w-full text-left`} title="Relatórios e Exportação">
                  <FileBarChart className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Relatórios Contábeis</span>}
                </Link>
              </div>
            </div>
          ) : isOportunidadesModule ? (
            <div className="flex-1 p-3 mt-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1 border-b border-sidebar-border/50 pb-4">
                {!isCollapsed && <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Módulo Oportunidades</span>}

                <Link to="/oportunidades" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/oportunidades' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Dashboard Oportunidades">
                  <LayoutDashboard className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Dashboard de Licitações</span>}
                </Link>

                <Link to="/oportunidades/busca" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/oportunidades/busca' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Busca Exata PNCP">
                  <Target className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Pesquisa no PNCP</span>}
                </Link>

                <Link to="/oportunidades/radar" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/oportunidades/radar' ? 'bg-emerald-500/10 text-emerald-600 font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Radar em Tempo Real">
                  <Radar className={`h-4 w-4 shrink-0 ${location.pathname === '/oportunidades/radar' ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} /> 
                  {!isCollapsed && (
                    <span className="flex items-center justify-between w-full">
                      Radar PNCP <span className="text-[7px] bg-red-500 text-white px-1 rounded animate-pulse">LIVE</span>
                    </span>
                  )}
                </Link>

                <Link to="/oportunidades/preditivo" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/oportunidades/preditivo' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Radar de Investimentos">
                  <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" /> {!isCollapsed && <span className="flex items-center gap-2">Radar Preditivo <Zap className="h-3 w-3 text-emerald-500 fill-current" /></span>}
                </Link>

                <Link to="/transparencia" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/transparencia' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Portal da Transparência">
                  <Activity className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Portal da Transparência</span>}
                </Link>

                <Link to="/robo-lances" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-all duration-300 ${location.pathname === '/robo-lances' ? 'bg-emerald-600 text-white font-medium shadow-md' : 'text-sidebar-foreground hover:bg-emerald-50 hover:text-emerald-600'}`} title="Robô de Lances PBE">
                  <Zap className={`h-4 w-4 shrink-0 ${location.pathname === '/robo-lances' ? 'fill-current' : 'text-emerald-500'}`} /> 
                  {!isCollapsed && <span className="flex items-center gap-2 font-bold tracking-tight">Robô de Lances <span className="text-[9px] bg-emerald-500/20 text-emerald-600 px-1 rounded border border-emerald-500/20">V3</span></span>}
                </Link>
              </div>
            </div>
          ) : isKanbanModule && activeKanbanFolder ? (
            <div className="flex-1 p-3 mt-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1 text-sidebar-foreground/80">
                {!isCollapsed && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 truncate">Pasta: {activeKanbanFolder.name}</span>
                  </div>
                )}
                
                <Link to={`/folder/${activeKanbanFolder.id}`} className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors mb-2 ${location.pathname === `/folder/${activeKanbanFolder.id}` ? 'bg-primary text-primary-foreground font-medium border border-primary text-white shadow-sm' : 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border border-primary/20'}`} title="Visão Geral da Pasta">
                  <FolderOpen className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Visão Geral</span>}
                </Link>

                {activeKanbanBoards.map(board => (
                  <Link
                    key={board.id}
                    to={`/board/${board.id}`}
                    className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === `/board/${board.id}` ? 'bg-sidebar-accent text-sidebar-foreground font-medium border border-border' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}
                    title={board.name}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: board.backgroundColor }}></div>
                      {!isCollapsed && <span className="truncate">{board.name}</span>}
                    </div>
                  </Link>
                ))}

                {activeKanbanBoards.length === 0 && !isCollapsed && (
                  <p className="text-[10px] text-muted-foreground italic px-2 py-4 text-center">Nenhum quadro nesta pasta.</p>
                )}
              </div>
              {/* Voltar para a Home */}
              <div className="mt-auto border-t border-sidebar-border/50 pt-4">
                <Link to="/tarefas" className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-sidebar-foreground hover:bg-sidebar-accent/50`} title="Sair da Pasta">
                  <LayoutGrid className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Tela Inicial</span>}
                </Link>
              </div>
            </div>
          ) : isConnectionModule ? (
            <div className="flex-1 p-3 mt-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                {!isCollapsed && <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Conexão</span>}
                
                <Link to="/conexao" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${location.pathname === '/conexao' && !location.search ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Todos os Links">
                  <LayoutGrid className={`h-4 w-4 shrink-0`} /> {!isCollapsed && <span>Todos os Links</span>}
                </Link>

                <Link to="/conexao?folder=favorites" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${location.search.includes('folder=favorites') ? 'bg-amber-500/10 text-amber-500 font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Meus Favoritos">
                  <Star className={`h-4 w-4 shrink-0 ${location.search.includes('folder=favorites') ? 'fill-current' : ''}`} /> {!isCollapsed && <span>Meus Favoritos</span>}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-sidebar-border space-y-1 mt-6">
                <Link to="/tarefas" className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${location.pathname === '/tarefas' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`} title="Principal">
                  <LayoutGrid className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Principal</span>}
                </Link>
                {hasScreenAccess('CALENDAR') && (
                  <Link to="/calendar" className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${location.pathname === '/calendar' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`} title="Calendário">
                    <Calendar className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Calendário</span>}
                  </Link>
                )}
                {hasScreenAccess('TEAM') && (
                  <Link to="/team" className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${location.pathname === '/team' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`} title="Equipe e Fluxo">
                    <Users className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Equipe e Fluxo</span>}
                  </Link>
                )}
                <Link to="/lixeira" className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${location.pathname === '/lixeira' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium text-destructive' : 'text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive'}`} title="Lixeira Global">
                  <Trash2 className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Lixeira Global</span>}
                </Link>
              </div>
            </>
          )
        }

        {/* DESKTOP APP CENTRAL */}
        <div className={`mt-2 border-t border-sidebar-border/30 pt-4 px-3 mb-2`}>
          {!isCollapsed && <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">Desktop Bot</h3>}
          <Link
            to="/desktop"
            className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-500/10 hover:text-emerald-500 transition-all group ${location.pathname === '/desktop' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'text-sidebar-foreground'}`}
            title="Central do Desktop"
          >
            <Monitor className={`h-4 w-4 shrink-0 group-hover:bounce-y`} /> 
            {!isCollapsed && <span>CENTRAL DO BOT</span>}
            {!isCollapsed && <div className="ml-auto bg-emerald-500 text-[8px] px-1 rounded-sm text-white font-bold animate-pulse">V1.0.1</div>}
          </Link>
        </div>

        {currencyQuotes && (
          <div className={`mt-auto border-t border-sidebar-border/50 shrink-0 bg-sidebar-accent/10 ${isCollapsed ? 'p-2 py-4 flex flex-col items-center gap-3' : 'p-4'}`}>
            {!isCollapsed ? (
              <>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Cotações (Ao Vivo)</span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium"><span className="text-emerald-500 font-bold">$</span> Dólar</span>
                    <span className="font-mono">R$ {currencyQuotes.usd}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium"><span className="text-blue-500 font-bold">€</span> Euro</span>
                    <span className="font-mono">R$ {currencyQuotes.eur}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-1 text-[10px] font-mono font-bold text-emerald-500" title={`Dólar: R$ ${currencyQuotes.usd}`}>
                  <span>$</span>
                  <span>{currencyQuotes.usd}</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-[10px] font-mono font-bold text-blue-500" title={`Euro: R$ ${currencyQuotes.eur}`}>
                  <span>€</span>
                  <span>{currencyQuotes.eur}</span>
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
};

export default AppSidebar;
