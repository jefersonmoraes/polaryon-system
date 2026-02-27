import { Droppable, Draggable, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { useKanbanStore } from '@/store/kanban-store';
import { KanbanList } from '@/types/kanban';
import { MoreHorizontal, Plus, Trash2, GripVertical } from 'lucide-react';
import { useState } from 'react';
import KanbanCardComponent from './KanbanCard';

interface Props {
  list: KanbanList;
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  onCardClick: (cardId: string) => void;
}

const KanbanListComponent = ({ list, dragHandleProps, onCardClick }: Props) => {
  const { cards, addCard, deleteList, updateList } = useKanbanStore();
  const listCards = cards
    .filter(c => c.listId === list.id)
    .sort((a, b) => a.position - b.position);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [showMenu, setShowMenu] = useState(false);

  const handleAdd = () => {
    if (newTitle.trim()) {
      addCard(list.id, newTitle.trim());
      setNewTitle('');
    }
  };

  const handleRename = () => {
    if (title.trim()) {
      updateList(list.id, { title: title.trim() });
      setEditing(false);
    }
  };

  return (
    <div className="kanban-list">
      {/* List header */}
      <div className="flex items-center gap-1 mb-2 px-1">
        <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            onBlur={handleRename}
            className="flex-1 bg-card rounded px-2 py-1 text-xs font-semibold outline-none border border-primary"
          />
        ) : (
          <h3
            className="flex-1 text-xs font-semibold cursor-pointer px-1 py-0.5"
            onClick={() => setEditing(true)}
          >
            {list.title}
          </h3>
        )}
        <span className="text-[10px] text-muted-foreground">{listCards.length}</span>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded hover:bg-secondary transition-colors">
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                <button
                  onClick={() => { deleteList(list.id); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-destructive hover:bg-secondary transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir lista
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cards */}
      <Droppable droppableId={list.id} type="CARD">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[4px] rounded transition-colors ${snapshot.isDraggingOver ? 'bg-kanban-drag/10' : ''}`}
          >
            {listCards.map((card, index) => (
              <Draggable key={card.id} draggableId={card.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={snapshot.isDragging ? 'rotate-3 shadow-lg' : ''}
                  >
                    <KanbanCardComponent card={card} onClick={() => onCardClick(card.id)} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Add card */}
      {adding ? (
        <div className="mt-1">
          <textarea
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } if (e.key === 'Escape') setAdding(false); }}
            placeholder="Título do cartão..."
            className="w-full bg-card rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary resize-none"
            rows={2}
          />
          <div className="flex gap-2 mt-1">
            <button onClick={handleAdd} className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium hover:bg-primary/90 transition-colors">
              Adicionar
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">×</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 w-full px-2 py-1.5 mt-1 rounded text-xs text-muted-foreground hover:bg-secondary/50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar cartão
        </button>
      )}
    </div>
  );
};

export default KanbanListComponent;
