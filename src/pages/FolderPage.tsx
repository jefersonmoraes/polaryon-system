import { useParams, Link } from 'react-router-dom';
import { useKanbanStore } from '@/store/kanban-store';
import { Plus, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import { useState } from 'react';
import { BOARD_COLORS } from '@/types/kanban';
import { motion } from 'framer-motion';

const FolderPage = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const { folders, boards, lists, cards, addBoard, deleteBoard, deleteFolder, updateFolder } = useKanbanStore();
  const folder = folders.find(f => f.id === folderId);
  const folderBoards = boards.filter(b => b.folderId === folderId);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingFolder, setEditingFolder] = useState(false);
  const [folderName, setFolderName] = useState(folder?.name || '');

  if (!folder) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Pasta não encontrada</div>;

  const handleAddBoard = () => {
    if (newName.trim() && folderId) {
      addBoard(folderId, newName.trim());
      setNewName('');
      setAdding(false);
    }
  };

  const handleRenameFolder = () => {
    if (folderName.trim()) {
      updateFolder(folder.id, { name: folderName.trim() });
      setEditingFolder(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-4 h-4 rounded" style={{ background: folder.color }} />
          {editingFolder ? (
            <input
              autoFocus
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRenameFolder()}
              onBlur={handleRenameFolder}
              className="text-2xl font-bold bg-transparent outline-none border-b-2 border-primary"
            />
          ) : (
            <h1 className="text-2xl font-bold">{folder.name}</h1>
          )}
          <button onClick={() => { setEditingFolder(true); setFolderName(folder.name); }} className="p-1 rounded hover:bg-secondary transition-colors">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {folderBoards.map((board, i) => {
            const boardLists = lists.filter(l => l.boardId === board.id);
            const boardCards = cards.filter(c => boardLists.some(l => l.id === c.listId));
            return (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/board/${board.id}`}
                  className="block rounded-lg h-28 p-4 relative group overflow-hidden transition-transform hover:scale-[1.02]"
                  style={{ background: board.backgroundColor }}
                >
                  <span className="font-semibold text-sm" style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                    {board.name}
                  </span>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    {boardLists.length} listas · {boardCards.length} cards
                  </p>
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); deleteBoard(board.id); }}
                    className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.8)' }} />
                  </button>
                </Link>
              </motion.div>
            );
          })}

          {/* Add board */}
          {adding ? (
            <div className="rounded-lg border-2 border-dashed border-border p-4 flex flex-col gap-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddBoard()}
                placeholder="Nome do board..."
                className="bg-secondary rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary"
              />
              <div className="flex gap-1 flex-wrap">
                {BOARD_COLORS.slice(0, 6).map(color => (
                  <button key={color} onClick={() => { if (newName.trim() && folderId) { addBoard(folderId, newName.trim(), color); setNewName(''); setAdding(false); } }}
                    className="w-6 h-6 rounded-sm hover:scale-110 transition-transform"
                    style={{ background: color }}
                  />
                ))}
              </div>
              <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="rounded-lg border-2 border-dashed border-border h-28 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Plus className="h-4 w-4" />
              Novo Board
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default FolderPage;
