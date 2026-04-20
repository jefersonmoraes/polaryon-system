import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useKanbanStore } from '@/store/kanban-store';
import { useUserPrefsStore } from '@/store/user-prefs-store';
import { Plus, ArrowLeft, Undo2, Archive as ArchiveIcon, Trash2, Clock, User, Star } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import KanbanListComponent from '@/components/board/KanbanList';
import CardDetailPanel from '@/components/board/CardDetailPanel';
import { BoardListView } from '@/components/board/BoardListView';
import { BoardCalendarView } from '@/components/board/BoardCalendarView';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmAction } from '@/components/ui/ConfirmAction';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactDOM from 'react-dom';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { hexToRgba } from '@/lib/utils';

const BoardPage = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const boards = useKanbanStore(state => state.boards);
  const lists = useKanbanStore(state => state.lists);
  const folders = useKanbanStore(state => state.folders);
  const cards = useKanbanStore(state => state.cards);
  const allMembers = useKanbanStore(state => state.members);
  const members = allMembers || [];
  const addList = useKanbanStore(state => state.addList);
  const updateList = useKanbanStore(state => state.updateList);
  const deleteList = useKanbanStore(state => state.deleteList);
  const permanentlyDeleteList = useKanbanStore(state => state.permanentlyDeleteList);
  const reorderLists = useKanbanStore(state => state.reorderLists);
  const moveCard = useKanbanStore(state => state.moveCard);
  const reorderCards = useKanbanStore(state => state.reorderCards);
  const updateCard = useKanbanStore(state => state.updateCard);
  const deleteCard = useKanbanStore(state => state.deleteCard);
  const permanentlyDeleteCard = useKanbanStore(state => state.permanentlyDeleteCard);
  const updateBoard = useKanbanStore(state => state.updateBoard);
  const fetchKanbanData = useKanbanStore(state => state.fetchKanbanData);
  const fetchBoardCards = useKanbanStore(state => state.fetchBoardCards);

  useEffect(() => {
    fetchKanbanData();
    if (boardId) {
      fetchBoardCards(boardId);
    }
  }, [fetchKanbanData, fetchBoardCards, boardId]);

  const undoAction = useKanbanStore(state => state.undoAction);
  const setUndoAction = useKanbanStore(state => state.setUndoAction);
  const executeUndo = useKanbanStore(state => state.executeUndo);
  const clearUndoAction = useKanbanStore(state => state.clearUndoAction);

  const boardPreferences = useUserPrefsStore(state => state.boardPreferences);
  const setBoardPreference = useUserPrefsStore(state => state.setBoardPreference);
  const isDark = useUserPrefsStore(state => state.isDark);

  const board = useMemo(() => boards.find(b => b.id === boardId), [boards, boardId]);
  const folder = useMemo(() => board ? folders.find(f => f.id === board.folderId) : null, [board, folders]);
  const boardLists = useMemo(() => lists
    .filter(l => l.boardId === boardId && !l.archived && !l.trashed)
    .sort((a, b) => a.position - b.position), [lists, boardId]);

  const currentUser = useAuthStore(state => state.currentUser);

  const [addingList, setAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showArchiveViewer, setShowArchiveViewer] = useState<'archived' | 'trashed' | null>(null);
  const [archiveTab, setArchiveTab] = useState<'cards' | 'lists'>('cards');

  const [searchParams, setSearchParams] = useSearchParams();
  const urlCardId = searchParams.get('cardId');

  const prefs = boardId ? (boardPreferences[boardId] || { viewMode: 'kanban', sortBy: 'default' }) : { viewMode: 'kanban', sortBy: 'default' };

  // Handle cardId from URL ⚒️🚀⚙️
  useEffect(() => {
    if (urlCardId && selectedCardId !== urlCardId) {
      setSelectedCardId(urlCardId);
      
      // Clean up URL softly without triggering additional full re-renders if possible
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('cardId');
      setSearchParams(newParams, { replace: true });
    }
  }, [urlCardId, selectedCardId, searchParams, setSearchParams]);


  // Auto-dismiss undo after 5 seconds
  useEffect(() => {
    if (!undoAction) return;
    const t = window.setTimeout(() => clearUndoAction(), 5000);
    return () => clearTimeout(t);
  }, [undoAction, clearUndoAction]);

  const setIsDragging = useKanbanStore(state => state.setIsDragging);

  const handleAddList = () => {
    if (currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit) {
      toast.error('Você não tem permissão para adicionar listas.');
      return;
    }
    if (newListTitle.trim() && boardId) {
      addList(boardId, newListTitle.trim());
      setNewListTitle('');
    }
  };

  const handleUndo = () => {
    executeUndo();
  };

  if (!board) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Board não encontrado</div>;

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);
    if (currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit) {
      toast.error('Você não tem permissão para mover cartões/listas.');
      return;
    }
    const { source, destination, type } = result;
    if (!destination || !boardId) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'LIST') {
      const newOrder = [...boardLists.map(l => l.id)];
      const [moved] = newOrder.splice(source.index, 1);
      newOrder.splice(destination.index, 0, moved);
      reorderLists(boardId, newOrder);
      return;
    }

    // Card move
    const cardId = result.draggableId;
    const store = useKanbanStore.getState();

    // If board is sorted by anything other than default, we only allow moving between lists.
    // Reordering within the same list is meaningless because visual order is strictly sorted.
    if (prefs.sortBy !== 'default') {
      if (source.droppableId === destination.droppableId) return;

      const destCards = store.cards
        .filter(c => c.listId === destination.droppableId && !c.archived && !c.trashed);
      const maxPos = Math.max(0, ...destCards.map(c => c.position));

      moveCard(cardId, destination.droppableId, maxPos + 1);
    } else {
      const sourceCards = store.cards
        .filter(c => c.listId === source.droppableId && !c.archived && !c.trashed)
        .sort((a, b) => a.position - b.position);
      const destCards = source.droppableId === destination.droppableId
        ? sourceCards
        : store.cards.filter(c => c.listId === destination.droppableId && !c.archived && !c.trashed).sort((a, b) => a.position - b.position);

      if (source.droppableId === destination.droppableId) {
        const newOrder = sourceCards.map(c => c.id);
        const [moved] = newOrder.splice(source.index, 1);
        newOrder.splice(destination.index, 0, moved);
        reorderCards(source.droppableId, newOrder);
      } else {
        const destListInfo = lists.find(l => l.id === destination.droppableId);
        const hasMoveToBoard = destListInfo?.automations?.find(a => a.type === 'move-to-board' && a.targetBoardId);

        moveCard(cardId, destination.droppableId, destination.index);

        if (!hasMoveToBoard) {
            const newDestCards = [...destCards.map(c => c.id)];
            newDestCards.splice(destination.index, 0, cardId);
            reorderCards(destination.droppableId, newDestCards);
        }
      }
    }

    // Check automations on destination list
    const destList = lists.find(l => l.id === destination.droppableId);
    if (destList && destList.automations && destList.automations.length > 0) {
      const card = store.cards.find(c => c.id === cardId);
      if (!card) return;

      const undoBase = {
        cardId,
        previousListId: source.droppableId,
        previousPosition: source.index,
      };

      const undoActionPayload = {
        previousListId: source.droppableId,
        timestamp: Date.now(),
        message: 'Ação automática'
      };

      destList.automations.forEach(action => {
        switch (action.type) {
          case 'archive':
            updateCard(cardId, { archived: true, automationUndoAction: { ...undoActionPayload, message: 'Arquivado automaticamente' } });
            setUndoAction({ ...undoBase, message: `"${card.title}" foi arquivado`, type: 'archived' });
            break;
          case 'trash':
            updateCard(cardId, { trashed: true, automationUndoAction: { ...undoActionPayload, message: 'Movido para lixeira automaticamente' } });
            setUndoAction({ ...undoBase, message: `"${card.title}" foi enviado para lixeira`, type: 'trashed' });
            break;
          case 'mark-completed':
            updateCard(cardId, { completed: true, automationUndoAction: { ...undoActionPayload, message: 'Concluído automaticamente' } });
            break;
          case 'mark-milestone':
            if (action.targetMilestoneTitle) {
              const changedMilestones = (card.milestones || []).map(m =>
                m.title.toLowerCase() === action.targetMilestoneTitle!.toLowerCase() ? { ...m, completed: true } : m
              );
              if (changedMilestones.some(m => m.completed && !(card.milestones || []).find(om => om.id === m.id)?.completed)) {
                updateCard(cardId, { milestones: changedMilestones, automationUndoAction: { ...undoActionPayload, message: `Etapa '${action.targetMilestoneTitle}' concluída` } });
              }
            }
            break;
          case 'move-to-board':
            // Delegation to kanban-store.ts
            break;
          case 'add-label':
            if (action.targetLabelName) {
              const labelName = action.targetLabelName.toUpperCase();
              let label = store.labels.find(l => l.name.toUpperCase() === labelName);
              let labelId = label?.id;
              
              if (!labelId) {
                // Predefined colors for new labels
                const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#64748b'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                labelId = store.addLabel(labelName, randomColor);
              }

              if (!card.labels.includes(labelId)) {
                const newLabels = [...card.labels, labelId];
                updateCard(cardId, { labels: newLabels, automationUndoAction: { ...undoActionPayload, message: `Etiqueta "${labelName}" adicionada` } });
              }
            }
            break;
          case 'remove-label':
            if (action.targetLabelName) {
              const labelName = action.targetLabelName.toUpperCase();
              const label = store.labels.find(l => l.name.toUpperCase() === labelName);
              if (label && card.labels.includes(label.id)) {
                const newLabels = card.labels.filter(id => id !== label.id);
                updateCard(cardId, { labels: newLabels, automationUndoAction: { ...undoActionPayload, message: `Etiqueta "${labelName}" removida` } });
              }
            }
            break;
        }
      });
    }
  };
  const boardStyle = {
    background: isDark
      ? `linear-gradient(to bottom right, ${hexToRgba(board.backgroundColor, 0.2)}, rgba(0,0,0,0.9))`
      : `${hexToRgba(board.backgroundColor, 0.15)}`
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={boardStyle}>
      {/* Board header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-black/20">
        {folder && (
          <Link to={`/folder/${folder.id}`} className="p-1 rounded hover:bg-white/10 transition-colors">
            <ArrowLeft className="h-4 w-4" style={{ color: '#fff' }} />
          </Link>
        )}
        <h2 className="font-bold text-sm" style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
          {board.name}
        </h2>

        <button onClick={() => updateBoard(board.id, { isFavorite: !board.isFavorite })}
          className="p-1 rounded hover:bg-white/20 transition-colors ml-1" title="Favoritar">
          <Star className={`h-4 w-4 transition-colors ${board.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-white/70 hover:text-white'}`} />
        </button>

        <div className="ml-auto flex items-center gap-2 overflow-x-auto custom-scrollbar pb-0 overflow-y-hidden">
          <div className="flex items-center bg-white/10 rounded overflow-hidden shrink-0">
            <button
              onClick={() => setBoardPreference(board.id, { viewMode: 'kanban' })}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${prefs.viewMode === 'kanban' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setBoardPreference(board.id, { viewMode: 'list' })}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${prefs.viewMode === 'list' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
            >
              Lista
            </button>
            <button
              onClick={() => setBoardPreference(board.id, { viewMode: 'calendar' })}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${prefs.viewMode === 'calendar' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
            >
              Calendário
            </button>
          </div>

          <Select
            value={prefs.sortBy}
            onValueChange={(v) => setBoardPreference(board.id, { sortBy: v as 'default' | 'priority' | 'assignee' | 'dueDate' })}
          >
            <SelectTrigger className="w-[160px] bg-white/10 text-white border-none h-8 text-xs font-medium">
                <SelectValue placeholder="Ordenar por..." />
            </SelectTrigger>
            <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                <SelectItem value="default" className="text-xs font-bold">Padrão</SelectItem>
                <SelectItem value="priority" className="text-xs font-bold">Prioridade</SelectItem>
                <SelectItem value="assignee" className="text-xs font-bold">Responsável</SelectItem>
                <SelectItem value="dueDate" className="text-xs font-bold">Data (Vencimento)</SelectItem>
            </SelectContent>
          </Select>

          <button onClick={() => setShowArchiveViewer('archived')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors text-white text-xs font-medium shrink-0">
            <ArchiveIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Arquivados</span>
          </button>
          <button onClick={() => setShowArchiveViewer('trashed')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors text-white text-xs font-medium shrink-0">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lixeira</span>
          </button>
        </div>
      </div>

      {/* Views */}
      {prefs.viewMode === 'kanban' && (
        <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}>
          <Droppable droppableId="board" type="LIST" direction="horizontal">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}
                className="flex-1 flex gap-3 overflow-x-auto overflow-y-hidden p-3 pb-4 items-start custom-scrollbar min-h-0 w-full">
                {boardLists.map((list, index) => (
                  <Draggable key={list.id} draggableId={list.id} index={index}>
                    {(provided, snapshot) => {
                      const child = (
                        <div ref={provided.innerRef} {...provided.draggableProps}
                          className={`shrink-0 transition-shadow flex flex-col ${snapshot.isDragging ? 'shadow-xl rotate-2' : ''}`}
                          style={{
                            ...provided.draggableProps.style,
                            maxHeight: snapshot.isDragging ? undefined : '100%',
                            height: snapshot.isDragging ? undefined : '100%'
                          }}
                        >
                          <KanbanListComponent list={list} dragHandleProps={provided.dragHandleProps} onCardClick={setSelectedCardId} />
                        </div>
                      );

                      if (snapshot.isDragging || snapshot.isDropAnimating) {
                        return ReactDOM.createPortal(child, document.body);
                      }
                      return child;
                    }}
                  </Draggable>
                ))}
                {provided.placeholder}

                {/* Add list */}
                {(currentUser?.role === 'ADMIN' || currentUser?.permissions?.canEdit) && (
                  <div className="shrink-0 w-[280px]">
                    {addingList ? (
                      <div className="kanban-list">
                        <input autoFocus value={newListTitle} onChange={e => setNewListTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddList(); if (e.key === 'Escape') setAddingList(false); }}
                          placeholder="Título da lista..."
                          className="w-full bg-card rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary mb-2" />
                        <div className="flex gap-2">
                          <button onClick={handleAddList} className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium hover:bg-primary/90 transition-colors">Adicionar</button>
                          <button onClick={() => setAddingList(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingList(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                        <Plus className="h-4 w-4" /> Adicionar lista
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {prefs.viewMode === 'list' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <BoardListView boardId={board.id} onCardClick={setSelectedCardId} sortBy={prefs.sortBy as 'default' | 'priority' | 'assignee' | 'dueDate'} />
        </div>
      )}

      {prefs.viewMode === 'calendar' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <BoardCalendarView boardId={board.id} onCardClick={setSelectedCardId} />
        </div>
      )}

      {/* Undo toast */}
      <AnimatePresence>
        {undoAction && (
          <motion.div
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3"
          >
            <span className="text-xs font-medium">{undoAction.message}</span>
            <button onClick={handleUndo}
              className="flex items-center gap-1 px-2 py-1 rounded bg-background/20 text-xs font-semibold hover:bg-background/30 transition-colors">
              <Undo2 className="h-3 w-3" /> Desfazer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card detail panel */}
      {
        selectedCardId && (
          <CardDetailPanel cardId={selectedCardId} onClose={() => setSelectedCardId(null)} />
        )
      }

      {/* Archive / Trash Viewer Modal */}
      <AnimatePresence>
        {showArchiveViewer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowArchiveViewer(null)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative bg-card w-full max-w-2xl rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-4 border-b border-border flex flex-col gap-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    {showArchiveViewer === 'archived' ? <ArchiveIcon className="h-5 w-5 text-accent" /> : <Trash2 className="h-5 w-5 text-destructive" />}
                    {showArchiveViewer === 'archived' ? 'Itens Arquivados' : 'Lixeira'}
                  </div>
                  <button onClick={() => setShowArchiveViewer(null)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors">✕</button>
                </div>
                <div className="flex items-center gap-4 border-b border-border/50 pb-0">
                  <button onClick={() => setArchiveTab('cards')} className={`text-sm font-medium pb-1.5 border-b-2 transition-colors ${archiveTab === 'cards' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Cartões</button>
                  <button onClick={() => setArchiveTab('lists')} className={`text-sm font-medium pb-1.5 border-b-2 transition-colors ${archiveTab === 'lists' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Listas</button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-background/50">
                {(() => {
                  if (archiveTab === 'cards') {
                    const filteredCards = cards.filter(c =>
                      lists.some(l => l.id === c.listId && l.boardId === boardId) &&
                      (showArchiveViewer === 'archived' ? c.archived && !c.trashed : c.trashed)
                    );

                    if (filteredCards.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          {showArchiveViewer === 'archived' ? <ArchiveIcon className="h-12 w-12 mb-3 opacity-20" /> : <Trash2 className="h-12 w-12 mb-3 opacity-20" />}
                          <p className="text-sm font-medium">Nenhum cartão encontrado.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {filteredCards.map(card => {
                          const originalList = lists.find(l => l.id === card.listId);
                          const assignee = members.find(m => m.id === card.assignee);
                          return (
                            <div key={card.id} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg border border-border bg-card transition-colors group">
                              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedCardId(card.id); setShowArchiveViewer(null); }}>
                                <h4 className="text-sm font-medium truncate mb-1 hover:text-primary transition-colors">{card.title}</h4>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(card.createdAt).toLocaleDateString('pt-BR')}</span>
                                  {originalList && <span>em <strong>{originalList.title}</strong></span>}
                                  {assignee && (
                                    <span className="flex items-center gap-1 ml-1" title={assignee.name}>
                                      <img src={assignee.avatar} alt={assignee.name} className="w-4 h-4 rounded-full object-cover" />
                                      {assignee.name.split(' ')[0]}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {(currentUser?.role === 'ADMIN' || currentUser?.permissions?.canEdit) && (
                                  <>
                                    <button onClick={() => updateCard(card.id, { archived: false, trashed: false })}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-primary hover:text-primary-foreground text-xs font-medium transition-colors">
                                      <Undo2 className="h-3.5 w-3.5" /> Restaurar
                                    </button>
                                    {showArchiveViewer === 'trashed' && (
                                      <ConfirmAction
                                        title="Excluir Permanentemente?"
                                        description="O cartão será excluído de forma permanente."
                                        onConfirm={() => permanentlyDeleteCard(card.id)}
                                        destructive
                                      >
                                        <button className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors opacity-40 group-hover:opacity-100" title="Excluir permanentemente">
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </ConfirmAction>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  } else {
                    const filteredLists = lists.filter(l =>
                      l.boardId === boardId &&
                      (showArchiveViewer === 'archived' ? l.archived && !l.trashed : l.trashed)
                    );

                    if (filteredLists.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          {showArchiveViewer === 'archived' ? <ArchiveIcon className="h-12 w-12 mb-3 opacity-20" /> : <Trash2 className="h-12 w-12 mb-3 opacity-20" />}
                          <p className="text-sm font-medium">Nenhuma lista encontrada.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {filteredLists.map(list => {
                          const listCardCount = cards.filter(c => c.listId === list.id).length;
                          return (
                            <div key={list.id} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors group">
                              <div className="flex-1 min-w-0 flex items-center gap-3">
                                {list.color && <div className="w-3 h-3 rounded-sm" style={{ background: list.color }} />}
                                <h4 className="text-sm font-medium truncate">{list.title}</h4>
                                <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">
                                  {listCardCount} cartões
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {(currentUser?.role === 'ADMIN' || currentUser?.permissions?.canEdit) && (
                                  <>
                                    <button onClick={() => updateList(list.id, { archived: false, trashed: false })}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-primary hover:text-primary-foreground text-xs font-medium transition-colors">
                                      <Undo2 className="h-3.5 w-3.5" /> Restaurar
                                    </button>
                                    {showArchiveViewer === 'trashed' && (
                                      <ConfirmAction
                                        title="Excluir Permanentemente?"
                                        description="A lista e seus cartões serão excluídos de forma permanente."
                                        onConfirm={() => permanentlyDeleteList(list.id)}
                                        destructive
                                      >
                                        <button className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors opacity-40 group-hover:opacity-100" title="Excluir permanentemente">
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </ConfirmAction>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
};

export default BoardPage;
