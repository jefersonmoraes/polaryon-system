import { useParams, Link } from 'react-router-dom';
import { useKanbanStore } from '@/store/kanban-store';
import { Plus, Trash2, Pencil, Palette, Archive, Star } from 'lucide-react';
import { useState } from 'react';
import { BOARD_COLORS } from '@/types/kanban';
import { motion } from 'framer-motion';
import { ConfirmAction } from '@/components/ui/ConfirmAction';
import { useNavigate } from 'react-router-dom';

const FolderPage = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { folders, boards, lists, cards, addBoard, updateBoard, updateFolder } = useKanbanStore();
  const folder = folders.find(f => f.id === folderId);
  const folderBoards = boards
    .filter(b => b.folderId === folderId && !b.trashed)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(BOARD_COLORS[0]);
  const [editingFolder, setEditingFolder] = useState(false);
  const [folderName, setFolderName] = useState(folder?.name || '');
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [showFolderColorPicker, setShowFolderColorPicker] = useState(false);
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (!folder) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Pasta não encontrada</div>;

  const handleAddBoard = () => {
    if (newName.trim() && folderId) {
      addBoard(folderId, newName.trim(), selectedColor);
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
        <div className="flex items-center gap-3 mb-6 relative">
          <button onClick={() => setShowFolderColorPicker(!showFolderColorPicker)} className="w-5 h-5 rounded hover:scale-110 transition-transform shadow-sm" style={{ background: folder.color }} title="Mudar cor da pasta" />

          {showFolderColorPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFolderColorPicker(false)} />
              <div className="absolute left-0 top-full mt-2 z-20 bg-popover border border-border rounded-lg shadow-lg p-3">
                <p className="text-[10px] text-muted-foreground mb-2 font-semibold">Cor da Pasta</p>
                <div className="flex flex-wrap gap-1.5 w-48 mb-2">
                  {BOARD_COLORS.map(color => (
                    <button key={color} onClick={() => { updateFolder(folder.id, { color }); setShowFolderColorPicker(false); }}
                      className={`w-6 h-6 rounded-sm hover:scale-110 transition-transform ${folder.color === color ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      style={{ background: color }} />
                  ))}
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] text-muted-foreground mb-1 font-semibold">Imagem Lateral</p>
                  <input type="file" accept="image/*" className="text-[10px] text-muted-foreground w-full mb-1"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => updateFolder(folder.id, { sideImage: event.target?.result as string });
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {folder.sideImage && (
                    <button onClick={() => updateFolder(folder.id, { sideImage: undefined })} className="text-[10px] text-destructive hover:underline block">Remover Imagem</button>
                  )}
                </div>
              </div>
            </>
          )}

          {editingFolder ? (
            <input autoFocus value={folderName} onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRenameFolder()} onBlur={handleRenameFolder}
              className="text-2xl font-bold bg-transparent outline-none border-b-2 border-primary" />
          ) : (
            <h1 className="text-2xl font-bold">{folder.name}</h1>
          )}
          <button onClick={() => { setEditingFolder(true); setFolderName(folder.name); }} className="p-1 rounded hover:bg-secondary transition-colors" title="Editar nome">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <ConfirmAction
              title="Excluir Pasta?"
              description="A pasta será movida para a lixeira. Boards dentro dela continuarão existindo até serem excluídos."
              onConfirm={() => { updateFolder(folder.id, { trashed: true }); navigate('/'); }}
              destructive
            >
              <button className="p-1.5 rounded bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors" title="Excluir Pasta">
                <Trash2 className="h-4 w-4" />
              </button>
            </ConfirmAction>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {folderBoards.map((board, i) => {
            const boardLists = lists.filter(l => l.boardId === board.id && !l.trashed && !l.archived);
            const boardCards = cards.filter(c => boardLists.some(l => l.id === c.listId) && !c.trashed && !c.archived);
            return (
              <motion.div key={board.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                <div className="relative group">
                  <Link to={`/board/${board.id}`}
                    className="block rounded-lg h-28 p-4 relative overflow-hidden transition-transform hover:scale-[1.02] bg-cover bg-center"
                    style={{ backgroundImage: board.backgroundImage ? `url(${board.backgroundImage})` : 'none', backgroundColor: board.backgroundColor }}>
                    {board.backgroundImage && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    )}
                    <div className="relative z-10 flex flex-col h-full">
                      {renamingBoardId === board.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (renameValue.trim()) updateBoard(board.id, { name: renameValue.trim() });
                              setRenamingBoardId(null);
                            }
                            if (e.key === 'Escape') setRenamingBoardId(null);
                          }}
                          onBlur={() => {
                            if (renameValue.trim()) updateBoard(board.id, { name: renameValue.trim() });
                            setRenamingBoardId(null);
                          }}
                          onClick={e => e.preventDefault()}
                          className="bg-black/50 text-white border-none outline-none font-bold text-sm w-full rounded px-1"
                        />
                      ) : (
                        <span className="font-bold text-sm text-white drop-shadow-md">
                          {board.name}
                        </span>
                      )}
                      <p className="text-xs mt-auto text-white drop-shadow-md font-medium">
                        {boardLists.length} listas · {boardCards.length} cards
                      </p>
                    </div>
                  </Link>
                  {/* Board actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={e => e.preventDefault()}>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateBoard(board.id, { isFavorite: !board.isFavorite }); }}
                      className="p-1.5 rounded hover:bg-black/30 transition-colors" style={{ color: 'rgba(255,255,255,0.9)' }}>
                      <Star className={`h-3.5 w-3.5 ${board.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    </button>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRenamingBoardId(board.id); setRenameValue(board.name); }}
                      className="p-1.5 rounded hover:bg-black/30 transition-colors" style={{ color: 'rgba(255,255,255,0.9)' }} title="Renomear">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingBoardId(editingBoardId === board.id ? null : board.id); }}
                      className="p-1.5 rounded hover:bg-black/30 transition-colors" style={{ color: 'rgba(255,255,255,0.9)' }}>
                      <Palette className="h-3.5 w-3.5" />
                    </button>
                    <div onClick={e => e.stopPropagation()}>
                      <ConfirmAction
                        title="Mover Board para Lixeira?"
                        description="O board será movido para a lixeira e pode ser restaurado depois."
                        onConfirm={() => updateBoard(board.id, { trashed: true })}
                        destructive
                      >
                        <button className="p-1.5 rounded hover:bg-black/30 transition-colors" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </ConfirmAction>
                    </div>
                  </div>
                  {/* Color picker for board */}
                  {editingBoardId === board.id && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-popover border border-border rounded-lg shadow-lg p-3">
                      <p className="text-[10px] text-muted-foreground mb-2 font-semibold">Cor do Board</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {BOARD_COLORS.map(color => (
                          <button key={color} onClick={() => { updateBoard(board.id, { backgroundColor: color }); setEditingBoardId(null); }}
                            className={`w-6 h-6 rounded-sm hover:scale-110 transition-transform ${board.backgroundColor === color ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                            style={{ background: color }} />
                        ))}
                      </div>
                      <div className="flex gap-2 items-center mb-2">
                        <label className="text-[10px] text-muted-foreground">Cor HEX:</label>
                        <input defaultValue={board.backgroundColor} maxLength={7}
                          onBlur={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) { updateBoard(board.id, { backgroundColor: e.target.value }); } }}
                          onKeyDown={e => { if (e.key === 'Enter' && /^#[0-9a-fA-F]{6}$/.test((e.target as HTMLInputElement).value)) { updateBoard(board.id, { backgroundColor: (e.target as HTMLInputElement).value }); setEditingBoardId(null); } }}
                          className="w-20 bg-secondary rounded px-2 py-1 text-xs outline-none border border-border font-mono" />
                      </div>
                      <div className="pt-2 border-t border-border">
                        <p className="text-[10px] text-muted-foreground mb-1 font-semibold">Imagem de Fundo</p>
                        <input type="file" accept="image/*" className="text-[10px] text-muted-foreground w-full mb-1"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => updateBoard(board.id, { backgroundImage: event.target?.result as string });
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        {board.backgroundImage && (
                          <button onClick={() => updateBoard(board.id, { backgroundImage: undefined })} className="text-[10px] text-destructive hover:underline block">Remover Imagem</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Add board */}
          {adding ? (
            <div className="rounded-lg border-2 border-dashed border-border p-4 flex flex-col gap-2">
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddBoard()}
                placeholder="Nome do board..."
                className="bg-secondary rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary" />
              <div className="flex gap-1 flex-wrap">
                {BOARD_COLORS.map(color => (
                  <button key={color} onClick={() => setSelectedColor(color)}
                    className={`w-6 h-6 rounded-sm hover:scale-110 transition-transform ${selectedColor === color ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                    style={{ background: color }} />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddBoard} className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium hover:bg-primary/90">
                  Criar
                </button>
                <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="rounded-lg border-2 border-dashed border-border h-28 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
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
