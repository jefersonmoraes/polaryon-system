import { Link, useLocation } from 'react-router-dom';
import { useKanbanStore } from '@/store/kanban-store';
import { FolderOpen, Plus, ChevronRight, LayoutGrid } from 'lucide-react';
import { useState } from 'react';

const AppSidebar = () => {
  const { folders, boards, addFolder } = useKanbanStore();
  const location = useLocation();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    if (newName.trim()) {
      addFolder(newName.trim());
      setNewName('');
      setAdding(false);
    }
  };

  return (
    <aside className="w-56 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col overflow-y-auto">
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pastas</span>
          <button
            onClick={() => setAdding(true)}
            className="p-1 rounded hover:bg-sidebar-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {adding && (
          <div className="mb-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              onBlur={() => { if (!newName.trim()) setAdding(false); }}
              placeholder="Nome da pasta..."
              className="w-full bg-sidebar-accent rounded px-2 py-1.5 text-xs outline-none border border-sidebar-border focus:border-sidebar-primary"
            />
          </div>
        )}

        <div className="space-y-0.5">
          {folders.map(folder => {
            const folderBoards = boards.filter(b => b.folderId === folder.id);
            const isExpanded = expandedFolders.has(folder.id);
            const isActive = location.pathname === `/folder/${folder.id}`;

            return (
              <div key={folder.id}>
                <div
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                    isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
                  onClick={() => toggleFolder(folder.id)}
                >
                  <ChevronRight className={`h-3 w-3 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: folder.color }} />
                  <Link to={`/folder/${folder.id}`} className="flex-1 truncate" onClick={e => e.stopPropagation()}>
                    {folder.name}
                  </Link>
                  <span className="text-muted-foreground text-[10px]">{folderBoards.length}</span>
                </div>

                {isExpanded && folderBoards.length > 0 && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    {folderBoards.map(board => (
                      <Link
                        key={board.id}
                        to={`/board/${board.id}`}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                          location.pathname === `/board/${board.id}` ? 'bg-sidebar-accent font-medium' : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
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

          {folders.length === 0 && !adding && (
            <p className="text-[11px] text-muted-foreground px-2 py-4 text-center">
              Crie sua primeira pasta para começar
            </p>
          )}
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
