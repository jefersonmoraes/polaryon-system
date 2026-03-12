import { motion } from 'framer-motion';
import { ArchiveIcon, Trash2, Folder as FolderIcon, LayoutGrid, Undo2, AlertTriangle } from 'lucide-react';
import { useKanbanStore } from '@/store/kanban-store';
import { useState } from 'react';

interface Props {
    type: 'archived' | 'trashed';
    onClose: () => void;
    initialTab?: 'folders' | 'boards' | 'budgets';
}

const GlobalArchiveViewer = ({ type, onClose, initialTab }: Props) => {
    const { folders, boards, budgets, updateFolder, permanentlyDeleteFolder, updateBoard, permanentlyDeleteBoard, restoreBudget, permanentlyDeleteBudget, updateBudget } = useKanbanStore();
    const [tab, setTab] = useState<'folders' | 'boards' | 'budgets'>(initialTab || 'folders');

    const filteredFolders = folders.filter(f => (type === 'archived' ? f.archived && !f.trashed : f.trashed));
    const filteredBoards = boards.filter(b => (type === 'archived' ? b.archived && !b.trashed : b.trashed));
    const filteredBudgets = budgets.filter(b => (type === 'archived' ? b.archived && !b.trashed : b.trashed));


    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative bg-card w-full max-w-2xl rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-border flex flex-col gap-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-foreground font-semibold">
                            {type === 'archived' ? <ArchiveIcon className="h-5 w-5 text-accent" /> : <Trash2 className="h-5 w-5 text-destructive" />}
                            {type === 'archived' ? 'Pastas e Boards Arquivados' : 'Lixeira Geral'}
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors">✕</button>
                    </div>
                    <div className="flex items-center gap-4 border-b border-border/50 pb-0">
                        <button onClick={() => setTab('folders')} className={`text-sm font-medium pb-1.5 border-b-2 transition-colors ${tab === 'folders' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Pastas</button>
                        <button onClick={() => setTab('boards')} className={`text-sm font-medium pb-1.5 border-b-2 transition-colors ${tab === 'boards' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Boards</button>
                        <button onClick={() => setTab('budgets')} className={`text-sm font-medium pb-1.5 border-b-2 transition-colors ${tab === 'budgets' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Orçamentos</button>
                    </div>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-background/50">
                    {type === 'trashed' && (filteredFolders.length > 0 || filteredBoards.length > 0 || filteredBudgets.length > 0) && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3 text-yellow-600 mb-6">
                            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                            <p className="text-sm leading-relaxed">Itens na lixeira por mais de 30 dias serão apagados permanentemente de forma automática.</p>
                        </div>
                    )}

                    {tab === 'folders' && (
                        filteredFolders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                {type === 'archived' ? <ArchiveIcon className="h-12 w-12 mb-3 opacity-20" /> : <Trash2 className="h-12 w-12 mb-3 opacity-20" />}
                                <p className="text-sm font-medium">Nenhuma pasta encontrada.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredFolders.map(folder => (
                                    <div key={folder.id} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors group">
                                        <div className="flex-1 min-w-0 flex items-center gap-3">
                                            <FolderIcon className="h-4 w-4 text-primary" />
                                            <h4 className="text-sm font-medium truncate">{folder.name}</h4>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button onClick={() => updateFolder(folder.id, { archived: false, trashed: false })}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-primary hover:text-primary-foreground text-xs font-medium transition-colors">
                                                <Undo2 className="h-3.5 w-3.5" /> Restaurar
                                            </button>
                                            {type === 'trashed' && (
                                                <button onClick={() => permanentlyDeleteFolder(folder.id)}
                                                    className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100" title="Excluir permanentemente">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                    {tab === 'boards' && (
                        filteredBoards.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                {type === 'archived' ? <ArchiveIcon className="h-12 w-12 mb-3 opacity-20" /> : <Trash2 className="h-12 w-12 mb-3 opacity-20" />}
                                <p className="text-sm font-medium">Nenhum board encontrado.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredBoards.map(board => (
                                    <div key={board.id} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors group">
                                        <div className="flex-1 min-w-0 flex items-center gap-3">
                                            <LayoutGrid className="h-4 w-4 text-primary" />
                                            <h4 className="text-sm font-medium truncate">{board.name}</h4>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button onClick={() => updateBoard(board.id, { archived: false, trashed: false })}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-primary hover:text-primary-foreground text-xs font-medium transition-colors">
                                                <Undo2 className="h-3.5 w-3.5" /> Restaurar
                                            </button>
                                            {type === 'trashed' && (
                                                <button onClick={() => permanentlyDeleteBoard(board.id)}
                                                    className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100" title="Excluir permanentemente">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                    {tab === 'budgets' && (
                        filteredBudgets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                {type === 'archived' ? <ArchiveIcon className="h-12 w-12 mb-3 opacity-20" /> : <Trash2 className="h-12 w-12 mb-3 opacity-20" />}
                                <p className="text-sm font-medium">{type === 'archived' ? 'Nenhum orçamento arquivado encontrado.' : 'Nenhum orçamento encontrado na lixeira.'}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredBudgets.map(budget => (
                                    <div key={budget.id} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors group">
                                        <div className="flex-1 min-w-0 flex items-center gap-3">
                                            <div className="h-4 w-4 rounded-sm flex items-center justify-center shrink-0 border border-border text-[10px] font-bold">R$</div>
                                            <h4 className="text-sm font-medium truncate">{budget.title || `Orçamento #${budget.id.substring(0, 4)}`}</h4>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button onClick={() => {
                                                if (type === 'archived') {
                                                    updateBudget(budget.id, { archived: false, trashed: false });
                                                } else {
                                                    restoreBudget(budget.id);
                                                }
                                            }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-primary hover:text-primary-foreground text-xs font-medium transition-colors">
                                                <Undo2 className="h-3.5 w-3.5" /> Restaurar
                                            </button>
                                            {type === 'trashed' && (
                                                <button onClick={() => permanentlyDeleteBudget(budget.id)}
                                                    className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100" title="Excluir permanentemente">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default GlobalArchiveViewer;
