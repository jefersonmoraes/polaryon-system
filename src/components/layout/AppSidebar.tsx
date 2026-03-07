import { Link, useLocation } from 'react-router-dom';
import { useKanbanStore } from '@/store/kanban-store';
import { useUserPrefsStore } from '@/store/user-prefs-store';
import { FolderOpen, Plus, ChevronRight, ChevronLeft, LayoutGrid, Calendar, Users, Building2, Truck, Briefcase, MapPin, Calculator, FileText, PiggyBank, LayoutDashboard, FileBarChart, ArrowLeftRight, Activity, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useState, useEffect } from 'react';

const AppSidebar = () => {
  const { mainCompanies } = useKanbanStore();
  const { isMobileMenuOpen, setMobileMenuOpen } = useUserPrefsStore();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(true);

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

              <Link to="/documentacao" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/documentacao' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Gestão de Documentos">
                <FolderOpen className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Gestão de Documentos</span>}
              </Link>

              <Link to="/documentacao/atestados" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/documentacao/atestados' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Atestados de Capacidade Técnica">
                <Briefcase className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Acervo Técnico</span>}
              </Link>

              <Link to="/documentacao/modelos" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/documentacao/modelos' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Modelos de Doc. Essenciais">
                <FileText className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Modelos de Doc. Essenciais</span>}
              </Link>
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

              <Link to="/contabil" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/contabil' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Visão Geral">
                <LayoutDashboard className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Visão Geral</span>}
              </Link>

              <Link to="/contabil/lancamentos" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/contabil/lancamentos' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Entradas e Saídas">
                <ArrowLeftRight className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Entradas e Saídas</span>}
              </Link>

              <Link to="/contabil/fluxo-caixa" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/contabil/fluxo-caixa' ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`} title="Simulador Fluxo de Caixa">
                <Activity className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Fluxo de Caixa</span>}
              </Link>

              <Link to="/contabil?tab=exportacao" className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${location.pathname === '/contabil' && location.search.includes('tab=exportacao') ? 'bg-primary text-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent'} w-full text-left`} title="Relatórios e Exportação">
                <FileBarChart className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Relatórios Contábeis</span>}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-sidebar-border space-y-1 mt-6">
              <Link to="/" className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${location.pathname === '/' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`} title="Principal">
                <LayoutGrid className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Principal</span>}
              </Link>
              <Link to="/calendar" className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${location.pathname === '/calendar' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`} title="Calendário">
                <Calendar className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Calendário</span>}
              </Link>
              <Link to="/team" className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${location.pathname === '/team' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`} title="Equipe e Fluxo">
                <Users className="h-4 w-4 shrink-0" /> {!isCollapsed && <span>Equipe e Fluxo</span>}
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
};

export default AppSidebar;
