import { Droppable, Draggable, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { useKanbanStore } from '@/store/kanban-store';
import { KanbanList } from '@/types/kanban';
import { MoreHorizontal, Plus, Trash2, GripVertical, Palette, Zap, ArrowRight, Archive, Trash, SmilePlus } from 'lucide-react';
import { useState } from 'react';
import KanbanCardComponent from './KanbanCard';
import { BOARD_COLORS } from '@/types/kanban';

interface Props {
  list: KanbanList;
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  onCardClick: (cardId: string) => void;
}

const KanbanListComponent = ({ list, dragHandleProps, onCardClick }: Props) => {
  const { cards, boards, addCard, deleteList, updateList } = useKanbanStore();
  const listCards = cards
    .filter(c => c.listId === list.id && !c.archived && !c.trashed)
    .sort((a, b) => a.position - b.position);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [colorHex, setColorHex] = useState(list.color || '');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const ICONS = ['📋', '✅', '🔄', '🚀', '⏳', '📦', '🗑️', '📁', '⭐', '🔥', '💡', '🎯', '📌', '🏷️', '🛠️', '📊'];

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

  const listStyle: React.CSSProperties = list.color
    ? { background: list.color, minWidth: 280, maxWidth: 280 }
    : {};

  return (
    <div className="kanban-list" style={listStyle}>
      {/* List header */}
      <div className="flex items-center gap-1 mb-2 px-1">
        <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {list.icon && <span className="text-sm">{list.icon}</span>}
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
        {list.automation && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-accent/20 text-accent" title={`Automação: ${list.automation.type}`}>
            <Zap className="h-2.5 w-2.5 inline" />
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">{listCards.length}</span>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded hover:bg-secondary transition-colors">
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
                <button
                  onClick={() => { setShowColorPicker(true); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-secondary transition-colors"
                >
                  <Palette className="h-3 w-3" /> Cor da lista
                </button>
                <button
                  onClick={() => { setShowIconPicker(true); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-secondary transition-colors"
                >
                  <SmilePlus className="h-3 w-3" /> Ícone
                </button>
                <button
                  onClick={() => { setShowAutomation(true); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-secondary transition-colors"
                >
                  <Zap className="h-3 w-3" /> Automação
                </button>
                <hr className="my-1 border-border" />
                <button
                  onClick={() => { deleteList(list.id); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-destructive hover:bg-secondary transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Excluir lista
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Color picker popover */}
      {showColorPicker && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
          <div className="relative z-20 bg-popover border border-border rounded-lg shadow-lg p-3 mb-2">
            <p className="text-[10px] text-muted-foreground mb-2 font-semibold">Cor da Lista</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {BOARD_COLORS.map(color => (
                <button key={color} onClick={() => { updateList(list.id, { color }); setShowColorPicker(false); }}
                  className={`w-6 h-6 rounded-sm hover:scale-110 transition-transform ${list.color === color ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                  style={{ background: color }} />
              ))}
              <button onClick={() => { updateList(list.id, { color: undefined }); setShowColorPicker(false); }}
                className="w-6 h-6 rounded-sm border-2 border-dashed border-muted-foreground/30 text-[8px] text-muted-foreground hover:scale-110 transition-transform"
                title="Remover cor">✕</button>
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-[10px] text-muted-foreground">HEX:</label>
              <input value={colorHex} onChange={e => setColorHex(e.target.value)} maxLength={7}
                onKeyDown={e => { if (e.key === 'Enter' && /^#[0-9a-fA-F]{6}$/.test(colorHex)) { updateList(list.id, { color: colorHex }); setShowColorPicker(false); } }}
                className="w-20 bg-secondary rounded px-2 py-1 text-xs outline-none border border-border font-mono" />
            </div>
          </div>
        </>
      )}

      {/* Icon picker */}
      {showIconPicker && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowIconPicker(false)} />
          <div className="relative z-20 bg-popover border border-border rounded-lg shadow-lg p-3 mb-2">
            <p className="text-[10px] text-muted-foreground mb-2 font-semibold">Ícone da Lista</p>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map(icon => (
                <button key={icon} onClick={() => { updateList(list.id, { icon }); setShowIconPicker(false); }}
                  className={`w-7 h-7 rounded hover:bg-secondary text-sm flex items-center justify-center ${list.icon === icon ? 'ring-2 ring-primary' : ''}`}>
                  {icon}
                </button>
              ))}
              <button onClick={() => { updateList(list.id, { icon: undefined }); setShowIconPicker(false); }}
                className="w-7 h-7 rounded hover:bg-secondary text-[10px] text-muted-foreground border border-dashed border-muted-foreground/30 flex items-center justify-center">✕</button>
            </div>
          </div>
        </>
      )}

      {/* Automation config */}
      {showAutomation && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowAutomation(false)} />
          <div className="relative z-20 bg-popover border border-border rounded-lg shadow-lg p-3 mb-2 space-y-2">
            <p className="text-[10px] text-muted-foreground font-semibold">Automação da Lista</p>
            <p className="text-[10px] text-muted-foreground">Ao mover um cartão para esta lista:</p>
            <div className="space-y-1">
              <button onClick={() => { updateList(list.id, { automation: { type: 'archive' } }); setShowAutomation(false); }}
                className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-secondary ${list.automation?.type === 'archive' ? 'bg-secondary ring-1 ring-primary' : ''}`}>
                <Archive className="h-3 w-3" /> Arquivar automaticamente
              </button>
              <button onClick={() => { updateList(list.id, { automation: { type: 'trash' } }); setShowAutomation(false); }}
                className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-secondary ${list.automation?.type === 'trash' ? 'bg-secondary ring-1 ring-primary' : ''}`}>
                <Trash className="h-3 w-3" /> Enviar para lixeira
              </button>
              {boards.filter(b => b.id !== list.boardId).length > 0 && (
                <>
                  <p className="text-[9px] text-muted-foreground mt-1">Mover para outro board:</p>
                  {boards.filter(b => {
                    // Get boards from any folder (cross-board move)
                    return b.id !== list.boardId;
                  }).map(b => (
                    <button key={b.id}
                      onClick={() => { updateList(list.id, { automation: { type: 'move-to-board', targetBoardId: b.id } }); setShowAutomation(false); }}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-secondary ${list.automation?.type === 'move-to-board' && list.automation.targetBoardId === b.id ? 'bg-secondary ring-1 ring-primary' : ''}`}>
                      <ArrowRight className="h-3 w-3" />
                      <span className="w-3 h-3 rounded-sm" style={{ background: b.backgroundColor }} />
                      {b.name}
                    </button>
                  ))}
                </>
              )}
              {list.automation && (
                <button onClick={() => { updateList(list.id, { automation: undefined }); setShowAutomation(false); }}
                  className="w-full text-[10px] text-destructive hover:underline mt-1">Remover automação</button>
              )}
            </div>
          </div>
        </>
      )}

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
