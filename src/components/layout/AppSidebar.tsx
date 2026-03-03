import { Link, useLocation } from 'react-router-dom';
import { useKanbanStore } from '@/store/kanban-store';
import { FolderOpen, Plus, ChevronRight, ChevronLeft, LayoutGrid, Calendar, Users, Building2, Truck, Briefcase, MapPin, Calculator } from 'lucide-react';
import { useState } from 'react';

const AppSidebar = () => {
  const { folders, boards, addFolder } = useKanbanStore();
  const location = useLocation();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSideImage, setNewSideImage] = useState<string | undefined>();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(true);

  const activeFolders = folders.filter(f => !f.archived && !f.trashed);
  const activeBoards = boards.filter(b => !b.archived && !b.trashed);

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAdd = () => {
    if (newName.trim()) {
      addFolder(newName.trim(), undefined, newSideImage);
      setNewName('');
      setNewSideImage(undefined);
      setAdding(false);
    }
  };

  const isCompanyModule = location.pathname.startsWith('/suppliers') || location.pathname.startsWith('/transporters');
  const isBudgetModule = location.pathname.startsWith('/budgets');

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-56'} shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col overflow-y-auto scrollbar-hide transition-all duration-300 relative group`}>
      <div className="h-16 shrink-0 flex items-center justify-center border-b border-sidebar-border/50">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="bg-sidebar-accent/50 hover:bg-sidebar-accent border border-sidebar-border rounded-lg p-1.5 shadow-sm transition-all text-sidebar-foreground flex items-center justify-center"
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
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

          <div className="p-3">
            {!isCollapsed && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pastas</span>
                <button
                  onClick={() => setAdding(true)}
                  className="p-1 rounded hover:bg-sidebar-accent transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            )}

            {isCollapsed && (
              <div className="flex justify-center mb-3">
                <button
                  onClick={() => { setIsCollapsed(false); setAdding(true); }}
                  className="p-1.5 rounded hover:bg-sidebar-accent transition-colors"
                  title="Nova Pasta"
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {adding && (
              <div className="mb-2 space-y-1.5 bg-sidebar-accent/30 p-2 rounded border border-border/50">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
                  placeholder="Nome da pasta..."
                  className="w-full bg-background rounded px-2 py-1.5 text-xs outline-none border border-sidebar-border focus:border-sidebar-primary"
                />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted-foreground">Imagem lateral (opcional):</label>
                  <input type="file" accept="image/*" className="text-[10px] text-muted-foreground w-full"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => setNewSideImage(event.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleAdd}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1 rounded text-xs font-medium transition-colors flex-1"
                    disabled={!newName.trim()}
                  >Criar Pasta</button>
                  <button
                    onClick={() => { setAdding(false); setNewSideImage(undefined); setNewName(''); }}
                    className="text-muted-foreground hover:text-foreground text-xs transition-colors px-2"
                  >Cancelar</button>
                </div>
              </div>
            )}

            <div className="space-y-0.5 mt-2">
              {activeFolders.map(folder => {
                const folderBoards = activeBoards.filter(b => b.folderId === folder.id);
                const isExpanded = expandedFolders.has(folder.id) && !isCollapsed;
                const isActive = location.pathname === `/folder/${folder.id}`;

                return (
                  <div key={folder.id}>
                    <div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'} ${isCollapsed ? 'justify-center' : ''}`}
                      onClick={() => isCollapsed ? setIsCollapsed(false) : toggleFolder(folder.id)}
                      title={folder.name}
                    >
                      {!isCollapsed && <ChevronRight className={`h-3 w-3 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />}
                      {folder.sideImage ? (
                        <img src={folder.sideImage} alt={folder.name} className="w-4 h-4 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: folder.color }} />
                      )}
                      {!isCollapsed && (
                        <>
                          <Link to={`/folder/${folder.id}`} className="flex-1 truncate" onClick={e => e.stopPropagation()}>
                            {folder.name}
                          </Link>
                          <span className="text-muted-foreground text-[10px]">{folderBoards.length}</span>
                        </>
                      )}
                    </div>

                    {isExpanded && folderBoards.length > 0 && !isCollapsed && (
                      <div className="ml-5 mt-0.5 space-y-0.5">
                        {folderBoards.map(board => (
                          <Link
                            key={board.id}
                            to={`/board/${board.id}`}
                            className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${location.pathname === `/board/${board.id}` ? 'bg-sidebar-accent font-medium' : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                              }`}
                          >
                            <LayoutGrid className="h-3 w-3 shrink-0" />
                            <span className="truncate">{board.name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {activeFolders.length === 0 && !adding && !isCollapsed && (
                <p className="text-[11px] text-muted-foreground px-2 py-4 text-center">
                  Crie sua primeira pasta para começar
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
};

export default AppSidebar;
