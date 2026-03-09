import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Moon, Sun, Plus, LayoutDashboard, LayoutGrid, ZoomIn, ZoomOut, Archive, Trash2, Briefcase, Truck, Calculator, Building2, FileText, PiggyBank, Menu, ChevronDown, MoreVertical, Target, Gavel } from 'lucide-react';
import { useKanbanStore } from '@/store/kanban-store';
import { useUserPrefsStore } from '@/store/user-prefs-store';
import { useAuthStore } from '@/store/auth-store';
import logo from '@/assets/logo.png';
import { useState } from 'react';
import GlobalArchiveViewer from './GlobalArchiveViewer';
import CompanyArchiveViewer from './CompanyArchiveViewer';
import DocsArchiveViewer from './DocsArchiveViewer';
import UserProfile from './UserProfile';
import { AnimatePresence } from 'framer-motion';

const AppHeader = () => {
  const { folders, boards, lists, cards, companies, budgets, notifications, markNotificationRead, markAllNotificationsRead, clearNotifications } = useKanbanStore();
  const { isDark, toggleTheme, uiZoom, setUiZoom, setMobileMenuOpen } = useUserPrefsStore();
  const { currentUser } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNavDropdown, setShowNavDropdown] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showGlobalArchiveViewer, setShowGlobalArchiveViewer] = useState<'archived' | 'trashed' | null>(null);
  const [showDocsArchiveViewer, setShowDocsArchiveViewer] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Filter notifications for the current user
  const userNotifications = notifications.filter(n => !n.userId || n.userId === currentUser?.id);
  const unreadCount = userNotifications.filter(n => !n.read).length;

  const isCompanyModule = location.pathname.startsWith('/suppliers') || location.pathname.startsWith('/transporters');
  const isBudgetModule = location.pathname.startsWith('/budgets');
  const isAdminModule = location.pathname.startsWith('/company') || location.pathname.startsWith('/admin');
  const isDocsModule = location.pathname.startsWith('/documentacao');
  const isAccountingModule = location.pathname.startsWith('/contabil');

  const searchResults = searchQuery.trim() ? (isCompanyModule ? {
    companies: companies.filter(c => !c.trashed && (
      c.razao_social.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.cnpj.includes(searchQuery)
    )).slice(0, 8),
    mainCompanies: [], cards: [], boards: [], folders: [], lists: [], budgets: []
  } : isBudgetModule ? {
    budgets: budgets.filter(b => !b.trashed && (
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      companies.find(c => c.id === (b as any).companyId)?.razao_social.toLowerCase().includes(searchQuery.toLowerCase()) ||
      companies.find(c => c.id === (b as any).companyId)?.nome_fantasia?.toLowerCase().includes(searchQuery.toLowerCase())
    )).slice(0, 8),
    mainCompanies: [], cards: [], boards: [], folders: [], lists: [], companies: []
  } : isAdminModule ? {
    mainCompanies: useKanbanStore.getState().mainCompanies.filter(c =>
      c.razaoSocial.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.nomeFantasia && c.nomeFantasia.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.cnpj.includes(searchQuery)
    ).slice(0, 8),
    companies: [], cards: [], boards: [], folders: [], lists: [], budgets: []
  } : isDocsModule ? {
    mainCompanies: [], companies: [], cards: [], boards: [], folders: [], lists: [], budgets: []
  } : isAccountingModule ? {
    mainCompanies: [], companies: [], cards: [], boards: [], folders: [], lists: [], budgets: []
  } : {
    mainCompanies: [],
    companies: [],
    budgets: [],
    cards: cards.filter(c => !c.archived && !c.trashed && (c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.description?.toLowerCase().includes(searchQuery.toLowerCase()))).slice(0, 5),
    boards: boards.filter(b => !b.archived && !b.trashed && b.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3),
    folders: folders.filter(f => !f.archived && !f.trashed && f.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3),
    lists: lists.filter(l => !l.archived && !l.trashed && l.title.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3),
  }) : null;

  return (
    <header className="kanban-header relative h-14 md:h-12 flex items-center px-2 md:px-4 gap-2 md:gap-3 shrink-0 z-50">
      {/* Hamburger menu for Mobile Sidebar Drawer */}
      <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-1.5 rounded hover:bg-primary/10 transition-colors shrink-0">
        <Menu className="h-5 w-5" />
      </button>

      <Link to="/" className="flex items-center gap-2 shrink-0">
        <img src={logo} alt="JJ Corporation" className="h-6 w-6 md:h-7 md:w-7 rounded-full" />
        <span className="font-bold text-sm tracking-tight hidden lg:block">POLARYON</span>
      </Link>

      <nav className="flex-1 min-w-0 flex items-center justify-start gap-1 mx-1 md:mx-2 md:border-l border-white/20 md:pl-2 pb-0.5 md:pb-0">
        {/* Desktop Browser View */}
        <div className="hidden lg:flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <Link
            to="/"
            className={`flex-shrink-0 whitespace-nowrap px-2 md:px-3 py-1.5 rounded text-[10px] md:text-xs font-medium transition-colors ${location.pathname === '/' ? 'bg-primary/20 text-white' : 'hover:bg-primary/10 text-white/80 hover:text-white'
              }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5 inline mr-1" />
            <span className="uppercase tracking-wider">Tarefas</span>
          </Link>
          <Link
            to="/kunbun"
            className={`px-2 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-medium transition-colors ${location.pathname === '/kunbun' || location.pathname.startsWith('/folder') || location.pathname.startsWith('/board') ? 'bg-primary/20 text-white' : 'hover:bg-primary/10 text-white/80 hover:text-white'
              }`}
          >
            <LayoutGrid className="h-3.5 w-3.5 inline mr-1" />
            <span className="uppercase tracking-wider">Kunbun</span>
          </Link>
          <Link
            to="/oportunidades"
            className={`px-2 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-medium transition-colors ${location.pathname.startsWith('/oportunidades') ? 'bg-primary/20 text-white' : 'hover:bg-primary/10 text-white/80 hover:text-white'
              }`}
          >
            <Target className="h-3.5 w-3.5 inline mr-1" />
            <span className="uppercase tracking-wider">Oportunidades</span>
          </Link>
          {/* Botão Gestor de Licitação Oculto a pedido do P.O
          <Link
            to="/licitacao"
            className={`px-2 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-medium transition-colors ${location.pathname.startsWith('/licitacao') ? 'bg-primary/20 text-white' : 'hover:bg-primary/10 text-white/80 hover:text-white'
              }`}
          >
            <Gavel className="h-3.5 w-3.5 inline mr-1" />
            <span className="uppercase tracking-wider">Gestor de Licitação</span>
          </Link>
          */}
          <Link
            to="/suppliers"
            className={`px-2 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-medium transition-colors ${location.pathname === '/suppliers' || location.pathname.startsWith('/suppliers-list') || location.pathname.startsWith('/transporters-list') ? 'bg-primary/20 text-white' : 'hover:bg-primary/10 text-white/80 hover:text-white'
              }`}
          >
            <Briefcase className="h-3.5 w-3.5 inline mr-1" />
            <span className="uppercase tracking-wider">Fornecedores e Transportadoras</span>
          </Link>
          <Link
            to="/budgets"
            className={`px-2 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-medium transition-colors ${location.pathname.startsWith('/budgets') ? 'bg-primary/20 text-white' : 'hover:bg-primary/10 text-white/80 hover:text-white'
              }`}
          >
            <Calculator className="h-3.5 w-3.5 inline mr-1" />
            <span className="uppercase tracking-wider">Orçamentos</span>
          </Link>
          <Link
            to="/company"
            className={`px-2 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-medium transition-colors ${location.pathname.startsWith('/company') ? 'bg-primary/20 text-accent font-bold' : 'hover:bg-primary/10 text-white/80 hover:text-white'
              }`}
          >
            <Building2 className="h-3.5 w-3.5 inline mr-1" />
            <span className="uppercase tracking-wider">Empresa</span>
          </Link>
          <Link
            to="/documentacao"
            className={`px-2 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-medium transition-colors ${location.pathname.startsWith('/documentacao') ? 'bg-primary/20 text-accent font-bold' : 'hover:bg-primary/10 text-white/80 hover:text-white'
              }`}
          >
            <FileText className="h-3.5 w-3.5 inline mr-1" />
            <span className="uppercase tracking-wider">Documentação</span>
          </Link>
          <Link
            to="/contabil"
            className={`px-2 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-medium transition-colors ${location.pathname.startsWith('/contabil') ? 'bg-primary/20 text-emerald-500 font-bold' : 'hover:bg-primary/10 text-white/80 hover:text-white'
              }`}
          >
            <PiggyBank className="h-3.5 w-3.5 inline mr-1" />
            <span className="uppercase tracking-wider">Contábil</span>
          </Link>
        </div>

        {/* Mobile/Tablet Dropdown */}
        <div className="lg:hidden relative">
          <button
            onClick={() => setShowNavDropdown(!showNavDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/20 text-white font-medium text-[11px] sm:text-xs hover:bg-primary/30 transition-colors border border-primary/20 shadow-sm"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="uppercase tracking-wider">Módulos</span>
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </button>

          {showNavDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNavDropdown(false)} />
              <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border shadow-xl rounded-lg overflow-hidden z-50 animate-in slide-in-from-top-2 flex flex-col">
                <Link to="/" onClick={() => setShowNavDropdown(false)} className={`px-4 py-3 flex items-center gap-3 text-sm border-b border-border/50 hover:bg-muted transition-colors ${location.pathname === '/' ? 'text-primary font-bold bg-primary/5' : 'text-foreground'}`}>
                  <div className="p-1.5 rounded bg-primary/10 text-primary"><LayoutDashboard className="h-4 w-4" /></div> Tarefas Principais
                </Link>
                <Link to="/kunbun" onClick={() => setShowNavDropdown(false)} className={`px-4 py-3 flex items-center gap-3 text-sm border-b border-border/50 hover:bg-muted transition-colors ${location.pathname === '/kunbun' || location.pathname.startsWith('/folder') || location.pathname.startsWith('/board') ? 'text-primary font-bold bg-primary/5' : 'text-foreground'}`}>
                  <div className="p-1.5 rounded bg-primary/10 text-primary"><LayoutGrid className="h-4 w-4" /></div> Kunbun (Projetos)
                </Link>
                <Link to="/oportunidades" onClick={() => setShowNavDropdown(false)} className={`px-4 py-3 flex items-center gap-3 text-sm border-b border-border/50 hover:bg-muted transition-colors ${location.pathname.startsWith('/oportunidades') ? 'text-primary font-bold bg-primary/5' : 'text-foreground'}`}>
                  <div className="p-1.5 rounded bg-primary/10 text-primary"><Target className="h-4 w-4" /></div> Oportunidades
                </Link>
                {/* Botão Mobile Gestor de Licitação Oculto a pedido do P.O
                <Link to="/licitacao" onClick={() => setShowNavDropdown(false)} className={`px-4 py-3 flex items-center gap-3 text-sm border-b border-border/50 hover:bg-muted transition-colors ${location.pathname.startsWith('/licitacao') ? 'text-primary font-bold bg-primary/5' : 'text-foreground'}`}>
                  <div className="p-1.5 rounded bg-primary/10 text-primary"><Gavel className="h-4 w-4" /></div> Gestor de Licitação
                </Link>
                */}
                <Link to="/suppliers" onClick={() => setShowNavDropdown(false)} className={`px-4 py-3 flex items-center gap-3 text-sm border-b border-border/50 hover:bg-muted transition-colors ${location.pathname === '/suppliers' || location.pathname.startsWith('/suppliers-list') || location.pathname.startsWith('/transporters-list') ? 'text-primary font-bold bg-primary/5' : 'text-foreground'}`}>
                  <div className="p-1.5 rounded bg-primary/10 text-primary"><Briefcase className="h-4 w-4" /></div> Fornecedores/Transportadoras
                </Link>
                <Link to="/budgets" onClick={() => setShowNavDropdown(false)} className={`px-4 py-3 flex items-center gap-3 text-sm border-b border-border/50 hover:bg-muted transition-colors ${location.pathname.startsWith('/budgets') ? 'text-primary font-bold bg-primary/5' : 'text-foreground'}`}>
                  <div className="p-1.5 rounded bg-primary/10 text-primary"><Calculator className="h-4 w-4" /></div> Orçamentos
                </Link>
                <Link to="/company" onClick={() => setShowNavDropdown(false)} className={`px-4 py-3 flex items-center gap-3 text-sm border-b border-border/50 hover:bg-muted transition-colors ${location.pathname.startsWith('/company') ? 'text-accent font-bold bg-accent/5' : 'text-foreground'}`}>
                  <div className="p-1.5 rounded bg-accent/10 text-accent"><Building2 className="h-4 w-4" /></div> Administradora
                </Link>
                <Link to="/documentacao" onClick={() => setShowNavDropdown(false)} className={`px-4 py-3 flex items-center gap-3 text-sm border-b border-border/50 hover:bg-muted transition-colors ${location.pathname.startsWith('/documentacao') ? 'text-accent font-bold bg-accent/5' : 'text-foreground'}`}>
                  <div className="p-1.5 rounded bg-accent/10 text-accent"><FileText className="h-4 w-4" /></div> Documentação Integrada
                </Link>
                <Link to="/contabil" onClick={() => setShowNavDropdown(false)} className={`px-4 py-3 flex items-center gap-3 text-sm hover:bg-muted transition-colors ${location.pathname.startsWith('/contabil') ? 'text-emerald-500 font-bold bg-emerald-500/5' : 'text-foreground'}`}>
                  <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-500"><PiggyBank className="h-4 w-4" /></div> Módulo Contábil
                </Link>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Desktop/Tablet secondary actions (Search, Archive, Trash, Notifications, Zoom) */}
      <div className="hidden lg:flex items-center">
        <div className={`relative shrink-0 flex items-center transition-all ${searchOpen ? 'w-48 sm:w-64' : 'w-8'}`}>
          {searchOpen ? (
            <>
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onBlur={() => setTimeout(() => { setSearchOpen(false); setSearchQuery(''); }, 200)}
                placeholder={isCompanyModule ? "Buscar empresas por nome ou CNPJ..." : isBudgetModule ? "Buscar orçamentos..." : isAdminModule ? "Buscar administradoras..." : isDocsModule ? "Buscar documentos..." : isAccountingModule ? "Buscar lançamentos..." : "Buscar quadros, pastas, cartões..."}
                className="w-full bg-primary/10 border-none rounded px-3 py-1.5 text-xs outline-none placeholder:text-kanban-header-foreground/50"
              />
              {searchResults && (
                <div className="absolute top-full mt-2 left-0 right-0 max-h-[80vh] overflow-y-auto bg-popover border border-border shadow-lg rounded-md p-2 z-50 text-foreground custom-scrollbar">
                  {searchResults.cards.length === 0 && searchResults.boards.length === 0 && searchResults.folders.length === 0 && searchResults.lists.length === 0 && searchResults.companies.length === 0 && searchResults.budgets.length === 0 && searchResults.mainCompanies?.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum resultado encontrado.</p>
                  ) : (
                    <>
                      {searchResults.mainCompanies && searchResults.mainCompanies.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1">Administradoras</p>
                          {searchResults.mainCompanies.map(c => (
                            <button key={c.id} onClick={() => navigate(`/company?id=${c.id}`)} className="w-full text-left px-2 py-2 text-xs rounded hover:bg-secondary transition-colors flex items-center gap-2">
                              <div className="shrink-0 p-1.5 bg-primary/10 rounded flex items-center justify-center text-primary">
                                <Building2 className="h-3 w-3" />
                              </div>
                              <div className="flex flex-col gap-0.5 overflow-hidden">
                                <span className="font-bold truncate">{c.nomeFantasia || c.razaoSocial} {c.isDefault && '(Padrão)'}</span>
                                <span className="text-[10px] text-muted-foreground truncate">{c.cnpj}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.folders.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1">Pastas</p>
                          {searchResults.folders.map(f => (
                            <button key={f.id} onClick={() => navigate(`/folder/${f.id}`)} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary truncate transition-colors">
                              {f.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.boards.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1">Boards</p>
                          {searchResults.boards.map(b => (
                            <button key={b.id} onClick={() => navigate(`/board/${b.id}`)} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary truncate transition-colors">
                              {b.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.lists.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1">Listas</p>
                          {searchResults.lists.map(l => {
                            const board = boards.find(b => b.id === l.boardId);
                            return (
                              <button key={l.id} onClick={() => navigate(`/board/${l.boardId}`)} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary truncate transition-colors flex flex-col">
                                <span>{l.title}</span>
                                {board && <span className="text-[10px] text-muted-foreground">no board {board.name}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {searchResults.companies && searchResults.companies.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1">Empresas</p>
                          {searchResults.companies.map(c => (
                            <button key={c.id} onClick={() => navigate(c.type === 'Fornecedor' ? '/suppliers-list' : '/transporters-list')} className="w-full text-left px-2 py-2 text-xs rounded hover:bg-secondary transition-colors flex items-center gap-2">
                              <div className="shrink-0 p-1.5 bg-primary/10 rounded flex items-center justify-center text-primary">
                                {c.type === 'Fornecedor' ? <Briefcase className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                              </div>
                              <div className="flex flex-col gap-0.5 overflow-hidden">
                                <span className="font-bold truncate">{c.nome_fantasia || c.razao_social}</span>
                                <span className="text-[10px] text-muted-foreground truncate">{c.cnpj}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.budgets && searchResults.budgets.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1">Orçamentos</p>
                          {searchResults.budgets.map(b => (
                            <button key={b.id} onClick={() => navigate('/budgets')} className="w-full text-left px-2 py-2 text-xs rounded hover:bg-secondary transition-colors flex items-center gap-2">
                              <div className="shrink-0 p-1.5 bg-primary/10 rounded flex items-center justify-center text-primary">
                                <Calculator className="h-3 w-3" />
                              </div>
                              <div className="flex flex-col gap-0.5 overflow-hidden">
                                <span className="font-bold truncate">{b.title}</span>
                                <span className="text-[10px] text-muted-foreground truncate">{companies.find(c => c.id === (b as any).companyId)?.nome_fantasia || 'Sem fornecedor'}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.cards && searchResults.cards.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1">Cartões</p>
                          {searchResults.cards.map(c => {
                            const list = lists.find(l => l.id === c.listId);
                            const board = list ? boards.find(b => b.id === list.boardId) : null;
                            return (
                              <button key={c.id} onClick={() => navigate(`/board/${board?.id}`)} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary transition-colors flex flex-col gap-0.5">
                                <span className="font-medium truncate">{c.title}</span>
                                {board && <span className="text-[10px] text-muted-foreground truncate">{board.name} {'>'} {list?.title}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <button onClick={() => setSearchOpen(true)} className="p-1.5 rounded hover:bg-primary/10 transition-colors">
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 mr-2 border-r border-border/50 pr-2">
          {!isCompanyModule && !isAdminModule && !isDocsModule && !isAccountingModule && (
            <button onClick={() => setShowGlobalArchiveViewer('archived')} className="p-1.5 rounded hover:bg-primary/10 transition-colors relative text-muted-foreground hover:text-accent" title="Pastas, Boards e Orçamentos Arquivados">
              <Archive className="h-4 w-4" />
            </button>
          )}
          {!isAdminModule && !isAccountingModule && (
            <button onClick={() => isDocsModule ? setShowDocsArchiveViewer(true) : setShowGlobalArchiveViewer('trashed')} className="p-1.5 rounded hover:bg-primary/10 transition-colors relative text-muted-foreground hover:text-destructive" title="Lixeira">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center shrink-0">
          <button onClick={() => setShowNotifications(!showNotifications)} className="p-1.5 rounded hover:bg-primary/10 transition-colors relative" title="Notificações">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full ring-2 ring-kanban-header shadow-sm" />
            )}
          </button>
        </div>

        <div className="flex items-center bg-primary/10 rounded overflow-hidden mr-1">
          <button
            onClick={() => setUiZoom(Math.max(0.7, uiZoom - 0.1))}
            className="p-1.5 hover:bg-primary/20 transition-colors text-kanban-header-foreground"
            title="Diminuir Zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold px-1 min-w-[36px] text-center">
            {Math.round(uiZoom * 100)}%
          </span>
          <button
            onClick={() => setUiZoom(Math.min(1.5, uiZoom + 0.1))}
            className="p-1.5 hover:bg-primary/20 transition-colors text-kanban-header-foreground"
            title="Aumentar Zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <button onClick={toggleTheme} className="hidden lg:block p-1.5 rounded hover:bg-primary/10 transition-colors shrink-0">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile "More" Actions Dropdown */}
      <div className="lg:hidden relative">
        <button
          onClick={() => setShowMoreActions(!showMoreActions)}
          className="p-1.5 rounded hover:bg-primary/10 transition-colors text-white/90"
          title="Mais Ações"
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        {showMoreActions && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMoreActions(false)} />
            <div className="absolute top-full right-0 mt-2 w-56 bg-card border border-border shadow-xl rounded-lg overflow-hidden z-50 animate-in slide-in-from-top-2 p-2 flex flex-col gap-1">

              <div className="flex items-center bg-primary/10 rounded-md px-2 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full bg-transparent border-none text-xs outline-none text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {!isCompanyModule && !isAdminModule && !isDocsModule && !isAccountingModule && (
                <button onClick={() => { setShowGlobalArchiveViewer('archived'); setShowMoreActions(false); }} className="w-full text-left px-3 py-2 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2">
                  <Archive className="h-4 w-4 text-accent" /> Arquivados
                </button>
              )}

              {!isAdminModule && !isAccountingModule && (
                <button onClick={() => { isDocsModule ? setShowDocsArchiveViewer(true) : setShowGlobalArchiveViewer('trashed'); setShowMoreActions(false); }} className="w-full text-left px-3 py-2 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-destructive" /> Lixeira
                </button>
              )}

              <button onClick={() => { setShowNotifications(!showNotifications); setShowMoreActions(false); }} className="w-full text-left px-3 py-2 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2 relative">
                <div className="relative">
                  <Bell className="h-4 w-4 text-primary" />
                  {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-destructive rounded-full" />}
                </div>
                Notificações {unreadCount > 0 && `(${unreadCount})`}
              </button>

              <div className="flex items-center justify-between px-3 py-2 text-xs border-t border-border mt-1 pt-2">
                <span className="text-muted-foreground font-medium">Zoom da Tela</span>
                <div className="flex items-center bg-secondary rounded-md overflow-hidden">
                  <button onClick={() => setUiZoom(Math.max(0.7, uiZoom - 0.1))} className="p-1 hover:bg-muted transition-colors"><ZoomOut className="h-3.5 w-3.5" /></button>
                  <span className="text-[10px] font-bold px-1.5">{Math.round(uiZoom * 100)}%</span>
                  <button onClick={() => setUiZoom(Math.min(1.5, uiZoom + 0.1))} className="p-1 hover:bg-muted transition-colors"><ZoomIn className="h-3.5 w-3.5" /></button>
                </div>
              </div>

              <button onClick={() => { toggleTheme(); setShowMoreActions(false); }} className="w-full text-left px-3 py-2 text-xs rounded-md hover:bg-muted transition-colors flex items-center justify-between border-t border-border mt-1">
                <span className="font-medium">Tema {isDark ? 'Claro' : 'Escuro'}</span>
                {isDark ? <Sun className="h-4 w-4 text-yellow-500" /> : <Moon className="h-4 w-4 text-slate-700" />}
              </button>

            </div>
          </>
        )}
      </div>

      <div className="shrink-0 hidden md:block ml-1">
        <UserProfile />
      </div>

      {showNotifications && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
          <div className="absolute top-full right-4 sm:right-6 mt-2 w-72 sm:w-80 bg-popover border border-border shadow-lg rounded-md z-50 text-foreground flex flex-col max-h-[400px]">
            <div className="p-3 border-b border-border flex items-center justify-between bg-muted/20">
              <h4 className="font-bold text-sm">Notificações</h4>
              <div className="flex gap-2">
                <button onClick={() => markAllNotificationsRead(currentUser?.id)} className="text-[10px] text-primary hover:underline font-medium">Ler Todas</button>
                <button onClick={() => clearNotifications(currentUser?.id)} className="text-[10px] text-destructive hover:underline font-medium">Limpar</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
              {userNotifications.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma notificação por enquanto.</p>
              ) : (
                userNotifications.map(n => (
                  <button key={n.id} onClick={() => { markNotificationRead(n.id); if (n.link) navigate(n.link); setShowNotifications(false); }} className={`w-full text-left p-2.5 rounded-lg transition-colors border overflow-hidden ${n.read ? 'border-transparent hover:bg-secondary' : 'border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50'}`}>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className={`text-[11px] font-bold truncate ${n.read ? 'text-foreground' : 'text-primary'}`}>{n.title}</span>
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap shrink-0">{new Date(n.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{n.message}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {showGlobalArchiveViewer && (
          isCompanyModule ? (
            <CompanyArchiveViewer onClose={() => setShowGlobalArchiveViewer(null)} />
          ) : isBudgetModule ? (
            <GlobalArchiveViewer
              type={showGlobalArchiveViewer}
              onClose={() => setShowGlobalArchiveViewer(null)}
              initialTab="budgets"
            />
          ) : (
            <GlobalArchiveViewer
              type={showGlobalArchiveViewer}
              onClose={() => setShowGlobalArchiveViewer(null)}
            />
          )
        )}
        {showDocsArchiveViewer && (
          <DocsArchiveViewer onClose={() => setShowDocsArchiveViewer(false)} />
        )}
      </AnimatePresence>
    </header>
  );
};

export default AppHeader;
