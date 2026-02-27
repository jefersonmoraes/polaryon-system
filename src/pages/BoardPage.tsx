import { useParams, Link } from 'react-router-dom';
import { useKanbanStore } from '@/store/kanban-store';
import { Plus, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import KanbanListComponent from '@/components/board/KanbanList';
import CardDetailPanel from '@/components/board/CardDetailPanel';
import { motion } from 'framer-motion';

const BoardPage = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const { boards, lists, folders, addList, reorderLists, moveCard, reorderCards } = useKanbanStore();
  const board = boards.find(b => b.id === boardId);
  const folder = board ? folders.find(f => f.id === board.folderId) : null;
  const boardLists = lists
    .filter(l => l.boardId === boardId)
    .sort((a, b) => a.position - b.position);

  const [addingList, setAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  if (!board) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Board não encontrado</div>;

  const handleAddList = () => {
    if (newListTitle.trim() && boardId) {
      addList(boardId, newListTitle.trim());
      setNewListTitle('');
    }
  };

  const handleDragEnd = (result: DropResult) => {
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
    const sourceCards = store.cards
      .filter(c => c.listId === source.droppableId)
      .sort((a, b) => a.position - b.position);
    const destCards = source.droppableId === destination.droppableId
      ? sourceCards
      : store.cards.filter(c => c.listId === destination.droppableId).sort((a, b) => a.position - b.position);

    if (source.droppableId === destination.droppableId) {
      const newOrder = sourceCards.map(c => c.id);
      const [moved] = newOrder.splice(source.index, 1);
      newOrder.splice(destination.index, 0, moved);
      reorderCards(source.droppableId, newOrder);
    } else {
      moveCard(cardId, destination.droppableId, destination.index);
      // Reorder destination
      const newDestCards = [...destCards.map(c => c.id)];
      newDestCards.splice(destination.index, 0, cardId);
      reorderCards(destination.droppableId, newDestCards);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: board.backgroundColor }}>
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
      </div>

      {/* Lists */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="board" type="LIST" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex-1 flex gap-3 overflow-x-auto overflow-y-hidden p-3 items-start"
            >
              {boardLists.map((list, index) => (
                <Draggable key={list.id} draggableId={list.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`shrink-0 transition-shadow ${snapshot.isDragging ? 'shadow-xl rotate-2' : ''}`}
                    >
                      <KanbanListComponent
                        list={list}
                        dragHandleProps={provided.dragHandleProps}
                        onCardClick={setSelectedCardId}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {/* Add list button */}
              <div className="shrink-0 w-[280px]">
                {addingList ? (
                  <div className="kanban-list">
                    <input
                      autoFocus
                      value={newListTitle}
                      onChange={e => setNewListTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddList(); if (e.key === 'Escape') setAddingList(false); }}
                      placeholder="Título da lista..."
                      className="w-full bg-card rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary mb-2"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleAddList} className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium hover:bg-primary/90 transition-colors">
                        Adicionar
                      </button>
                      <button onClick={() => setAddingList(false)} className="text-xs text-muted-foreground hover:text-foreground">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingList(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar lista
                  </button>
                )}
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Card detail panel */}
      {selectedCardId && (
        <CardDetailPanel cardId={selectedCardId} onClose={() => setSelectedCardId(null)} />
      )}
    </div>
  );
};

export default BoardPage;
