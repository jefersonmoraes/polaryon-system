import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Moon, Sun, Plus, LayoutDashboard, ZoomIn, ZoomOut, Archive, Trash2, Briefcase, Truck } from 'lucide-react';
import { useKanbanStore } from '@/store/kanban-store';
import logo from '@/assets/logo.png';
import { useState } from 'react';
import GlobalArchiveViewer from './GlobalArchiveViewer';
import CompanyArchiveViewer from './CompanyArchiveViewer';
import { AnimatePresence } from 'framer-motion';

const AppHeader = () => {
  const { isDark, toggleTheme, uiZoom, setUiZoom, folders, boards, lists, cards, companies, notifications, markNotificationRead, markAllNotificationsRead, clearNotifications } = useKanbanStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGlobalArchiveViewer, setShowGlobalArchiveViewer] = useState<'archived' | 'trashed' | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const isCompanyModule = location.pathname.startsWith('/suppliers') || location.pathname.startsWith('/transporters');

  const searchResults = searchQuery.trim() ? (isCompanyModule ? {
    companies: companies.filter(c => !c.trashed && (
      c.razao_social.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.cnpj.includes(searchQuery)
    )).slice(0, 8),
    cards: [], boards: [], folders: [], lists: []
  } : {
    companies: [],
    cards: cards.filter(c => !c.archived && !c.trashed && (c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.description?.toLowerCase().includes(searchQuery.toLowerCase()))).slice(0, 5),
    boards: boards.filter(b => !b.archived && !b.trashed && b.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3),
    folders: folders.filter(f => !f.archived && !f.trashed && f.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3),
    lists: lists.filter(l => !l.archived && !l.trashed && l.title.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3),
  }) : null;

  return (
    <header className="kanban-header h-12 flex items-center px-4 gap-3 shrink-0 z-50">
      <Link to="/" className="flex items-center gap-2 shrink-0">
        <img src={logo} alt="JJ Corporation" className="h-7 w-7 rounded-full" />
        <span className="font-bold text-sm tracking-tight hidden sm:block">POLARYON</span>
      </Link>

      <nav className="flex items-center gap-1 ml-4 border-l border-white/20 pl-4">
        <Link
          to="/"
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${location.pathname === '/' ? 'bg-primary/20 text-white' : 'hover:bg-primary/10 text-white/80 hover:text-white'
            }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5 inline mr-1" />
          <span className="uppercase tracking-wider">Tarefas</span>
        </Link>
        <Link
          to="/suppliers"
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${location.pathname === '/suppliers' ? 'bg-primary/20 text-white' : 'hover:bg-primary/10 text-white/80 hover:text-white'
            }`}
        >
          <span className="uppercase tracking-wider">Fornecedores e Transportadoras</span>
        </Link>
      </nav>

      <div className="flex-1" />

      <div className={`relative flex items-center transition-all ${searchOpen ? 'w-64' : 'w-8'}`}>
        {searchOpen ? (
          <>
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onBlur={() => setTimeout(() => { setSearchOpen(false); setSearchQuery(''); }, 200)}
              placeholder={isCompanyModule ? "Buscar empresas por nome ou CNPJ..." : "Buscar quadros, pastas, cartões..."}
              className="w-full bg-primary/10 border-none rounded px-3 py-1.5 text-xs outline-none placeholder:text-kanban-header-foreground/50"
            />
            {searchResults && (
              <div className="absolute top-full mt-2 left-0 right-0 max-h-[80vh] overflow-y-auto bg-popover border border-border shadow-lg rounded-md p-2 z-50 text-foreground custom-scrollbar">
                {searchResults.cards.length === 0 && searchResults.boards.length === 0 && searchResults.folders.length === 0 && searchResults.lists.length === 0 && searchResults.companies.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum resultado encontrado.</p>
                ) : (
                  <>
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
        {!isCompanyModule && (
          <button onClick={() => setShowGlobalArchiveViewer('archived')} className="p-1.5 rounded hover:bg-primary/10 transition-colors relative text-muted-foreground hover:text-accent" title="Pastas e Boards Arquivados">
            <Archive className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => setShowGlobalArchiveViewer('trashed')} className="p-1.5 rounded hover:bg-primary/10 transition-colors relative text-muted-foreground hover:text-destructive" title="Lixeira">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        <button onClick={() => setShowNotifications(!showNotifications)} className="p-1.5 rounded hover:bg-primary/10 transition-colors relative" title="Notificações">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full ring-2 ring-kanban-header shadow-sm" />
          )}
        </button>
        {showNotifications && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
            <div className="absolute top-full right-0 mt-2 w-80 bg-popover border border-border shadow-lg rounded-md z-50 text-foreground flex flex-col max-h-[400px]">
              <div className="p-3 border-b border-border flex items-center justify-between bg-muted/20">
                <h4 className="font-bold text-sm">Notificações</h4>
                <div className="flex gap-2">
                  <button onClick={markAllNotificationsRead} className="text-[10px] text-primary hover:underline font-medium">Ler Todas</button>
                  <button onClick={clearNotifications} className="text-[10px] text-destructive hover:underline font-medium">Limpar</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhuma notificação por enquanto.</p>
                ) : (
                  notifications.map(n => (
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

      <button onClick={toggleTheme} className="p-1.5 rounded hover:bg-primary/10 transition-colors">
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-accent-foreground">
        JJ
      </div>

      <AnimatePresence>
        {showGlobalArchiveViewer && (
          isCompanyModule ? (
            <CompanyArchiveViewer onClose={() => setShowGlobalArchiveViewer(null)} />
          ) : (
            <GlobalArchiveViewer
              type={showGlobalArchiveViewer}
              onClose={() => setShowGlobalArchiveViewer(null)}
            />
          )
        )}
      </AnimatePresence>
    </header>
  );
};

export default AppHeader;
