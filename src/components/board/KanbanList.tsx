import { Droppable, Draggable, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { useKanbanStore } from '@/store/kanban-store';
import { useUserPrefsStore } from '@/store/user-prefs-store';
import { KanbanList, Card } from '@/types/kanban';
import { MoreHorizontal, Plus, Trash2, GripVertical, Palette, Zap, ArrowRight, Archive, SmilePlus, CheckSquare, Calendar, Tag } from 'lucide-react';
import { useState } from 'react';
import ReactDOM from 'react-dom';
import KanbanCardComponent from './KanbanCard';
import { BOARD_COLORS } from '@/types/kanban';
import { ConfirmAction } from '@/components/ui/ConfirmAction';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { hexToRgba, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  list: KanbanList;
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  onCardClick: (cardId: string) => void;
}

const KanbanListComponent = ({ list, dragHandleProps, onCardClick }: Props) => {
  const { cards, boards, addCard, deleteList, updateList, labels } = useKanbanStore();
  const { boardPreferences, isDark, uiZoom } = useUserPrefsStore();
  const prefs = boardPreferences[list.boardId] || { viewMode: 'kanban', sortBy: 'default' };
  const { currentUser } = useAuthStore();

  const listCards = cards
    .filter(c => c.listId === list.id && !c.archived && !c.trashed)
    .sort((a, b) => {
      if (prefs.sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return a.position - b.position;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (prefs.sortBy === 'assignee') {
        if (!a.assignee && !b.assignee) return a.position - b.position;
        if (!a.assignee) return 1;
        if (!b.assignee) return -1;
        return a.assignee.localeCompare(b.assignee);
      }
      if (prefs.sortBy === 'priority') {
        const getPrio = (card: Card) => {
          const cardLabels = labels.filter(l => card.labels.includes(l.id));
          if (cardLabels.some(l => l.name.toLowerCase().includes('urgent') || l.color === '#ef4444')) return 1; // Urgente
          if (cardLabels.some(l => l.name.toLowerCase().includes('important') || l.color === '#f97316')) return 2; // Importante
          if (cardLabels.some(l => l.color === '#eab308')) return 3; // Warning / Em progresso
          if (cardLabels.some(l => l.color === '#22c55e')) return 5; // Success / Concluído
          if (cardLabels.length > 0) return 4;
          return 99;
        };
        const pA = getPrio(a);
        const pB = getPrio(b);
        if (pA !== pB) return pA - pB;
        return a.position - b.position;
      }
      
      // Default: Position (which is managed chronologically by the store)
      return a.position - b.position;
    });

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [colorHex, setColorHex] = useState(list.color || '');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [milestoneInput, setMilestoneInput] = useState('');
  const [labelAddInput, setLabelAddInput] = useState('');
  const [labelRemoveInput, setLabelRemoveInput] = useState('');

  const ICONS = [
    '📋', '📝', '✅', '☑️', '✔️', '❌', '🚫', '⚠️', '❗', '❓',
    '🔄', '🔁', '🚀', '🛸', '⭐', '🌟', '✨', '🔥', '💥', '💡',
    '🎯', '📌', '📍', '🏷️', '🔖', '🛠️', '🔧', '🔨', '⚙️', '📊',
    '📈', '📉', '📅', '📆', '⏳', '⌛', '⏰', '⏱️', '📦', '📫',
    '📥', '📤', '✉️', '📱', '💻', '🖥️', '🔍', '🔎', '🗑️', '📁',
    '📂', '🗂️', '📄', '📑', '🔐', '🔓', '🔑', '🔗', '📎', '💼',
    '🏆', '🥇', '🎉', '🎈', '🎁', '🚀', '🏃', '🚶', '🛑', '🚧'
  ];

  const handleAdd = () => {
    if (currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit) {
      toast.error('Você não tem permissão para adicionar cartões.');
      return;
    }
    if (newTitle.trim()) {
      addCard(list.id, newTitle.trim());
      setNewTitle('');
    }
  };

  const handleRename = () => {
    if (currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit) {
      setEditing(false);
      return;
    }
    if (title.trim()) {
      updateList(list.id, { title: title.trim() });
      setEditing(false);
    }
  };


  const listStyle: React.CSSProperties = list.color
    ? { background: isDark ? hexToRgba(list.color, 0.1) : hexToRgba(list.color, 0.15), minWidth: 280, maxWidth: 280, backdropFilter: 'blur(12px)', borderColor: hexToRgba(list.color, isDark ? 0.2 : 0.4), borderWidth: '1px' }
    : { minWidth: 280, maxWidth: 280, background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)', borderWidth: '1px', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' };

  const toggleAutomationType = (
    type: 'archive' | 'trash' | 'move-to-board' | 'mark-completed' | 'mark-milestone' | 'sync-google-calendar' | 'add-label' | 'remove-label', 
    targetBoardId?: string, 
    targetMilestoneTitle?: string,
    targetLabelName?: string
  ) => {
    const current = list.automations || [];
    const existsIndex = current.findIndex(a => 
      a.type === type && 
      a.targetBoardId === targetBoardId && 
      a.targetMilestoneTitle === targetMilestoneTitle &&
      a.targetLabelName === targetLabelName
    );
    let updated;
    if (existsIndex >= 0) {
      updated = current.filter((_, i) => i !== existsIndex);
    } else {
      updated = [...current, { type, targetBoardId, targetMilestoneTitle, targetLabelName }];
    }
    updateList(list.id, { automations: updated.length > 0 ? updated : undefined });
    setMilestoneInput('');
    setLabelAddInput('');
    setLabelRemoveInput('');
  };

  return (
    <div className={`kanban-list flex flex-col rounded-lg max-h-full ${isDark ? 'shadow-md' : 'shadow-lg shadow-black/10'}`} style={listStyle}>
      {/* List header */}
      <div className="flex items-center gap-1 mb-2 px-1">
        <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {list.icon && <span className="text-sm">{list.icon}</span>}
        {editing ? (
          <input
            id={`list-rename-${list.id}`}
            name="listTitle"
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            onBlur={handleRename}
            className="flex-1 bg-card rounded px-2 py-1 text-xs font-semibold outline-none border border-primary"
          />
        ) : (
          <h3
            className={`flex-1 text-xs font-semibold px-1 py-0.5 ${currentUser?.role === 'ADMIN' || currentUser?.permissions?.canEdit ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if (currentUser?.role === 'ADMIN' || currentUser?.permissions?.canEdit) {
                setEditing(true);
              }
            }}
          >
            {list.title}
          </h3>
        )}
        {list.automations && list.automations.length > 0 && (
          <span className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-accent/20 text-accent" title={`Automações ativas: ${list.automations.length}`}>
            <Zap className="h-2.5 w-2.5" />
            <span className="font-bold">{list.automations.length}</span>
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">{listCards.length}</span>
        {(currentUser?.role === 'ADMIN' || currentUser?.permissions?.canEdit) && (
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
                    onClick={() => {
                      if (window.confirm("A lista será arquivada e não aparecerá no board princial, mas pode ser restaurada acessando os itens arquivados.")) {
                        updateList(list.id, { archived: true });
                        setShowMenu(false);
                      }
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-muted-foreground"
                  >
                    <Archive className="h-3 w-3" /> Arquivar lista
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("A lista será movida para a lixeira. Você poderá restaurá-la mais tarde na visualização da lixeira.")) {
                        updateList(list.id, { trashed: true });
                        setShowMenu(false);
                      }
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Enviar para lixeira
                  </button>
                </div>
              </>
            )}
          </div>
        )}
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
              <label htmlFor={`list-color-hex-${list.id}`} className="text-[10px] text-muted-foreground">HEX:</label>
              <input 
                id={`list-color-hex-${list.id}`}
                name="listColorHex"
                value={colorHex} onChange={e => setColorHex(e.target.value)} maxLength={7}
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
          <div className="relative z-20 bg-popover border border-border rounded-lg shadow-lg p-3 mb-2 w-[240px]">
            <p className="text-[10px] text-muted-foreground mb-2 font-semibold">Ícone da Lista</p>
            <div className="grid grid-cols-6 gap-1.5 max-h-[200px] overflow-y-auto p-1 custom-scrollbar">
              <button onClick={() => { updateList(list.id, { icon: undefined }); setShowIconPicker(false); }}
                className="w-7 h-7 rounded hover:bg-secondary text-[10px] text-muted-foreground border border-dashed border-muted-foreground/30 flex items-center justify-center" title="Remover ícone">✕</button>
              {ICONS.map(icon => (
                <button key={icon} onClick={() => { updateList(list.id, { icon }); setShowIconPicker(false); }}
                  className={`w-7 h-7 rounded hover:bg-secondary text-sm flex items-center justify-center ${list.icon === icon ? 'ring-2 ring-primary' : ''}`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Automation config */}
      {/* Automation Modal - Centralized and Premium */}
      {showAutomation && ReactDOM.createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAutomation(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Automação da Lista</h3>
                    <p className="text-[10px] text-muted-foreground">Regras disparadas ao mover um cartão para esta lista</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAutomation(false)}
                  className="p-1.5 rounded-full hover:bg-secondary transition-colors text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-1">Ações Automáticas</p>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <button onClick={() => toggleAutomationType('mark-completed')}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 text-xs rounded-lg border transition-all active:scale-[0.98]",
                        list.automations?.some(a => a.type === 'mark-completed') 
                          ? "bg-primary/10 border-primary text-primary font-bold shadow-sm" 
                          : "bg-secondary/30 border-border/50 hover:border-border hover:bg-secondary/50 text-foreground/80"
                      )}>
                      <CheckSquare className="h-4 w-4" /> 
                      <span className="flex-1 text-left">Marcar cartão como concluído</span>
                      {list.automations?.some(a => a.type === 'mark-completed') && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </button>

                    <button onClick={() => toggleAutomationType('sync-google-calendar')}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 text-xs rounded-lg border transition-all active:scale-[0.98]",
                        list.automations?.some(a => a.type === 'sync-google-calendar') 
                          ? "bg-primary/10 border-primary text-primary font-bold shadow-sm" 
                          : "bg-secondary/30 border-border/50 hover:border-border hover:bg-secondary/50 text-foreground/80"
                      )}>
                      <Calendar className="h-4 w-4" /> 
                      <span className="flex-1 text-left">Sincronizar com Google Agenda</span>
                      {list.automations?.some(a => a.type === 'sync-google-calendar') && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </button>

                    <button onClick={() => toggleAutomationType('archive')}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 text-xs rounded-lg border transition-all active:scale-[0.98]",
                        list.automations?.some(a => a.type === 'archive') 
                          ? "bg-primary/10 border-primary text-primary font-bold shadow-sm" 
                          : "bg-secondary/30 border-border/50 hover:border-border hover:bg-secondary/50 text-foreground/80"
                      )}>
                      <Archive className="h-4 w-4" /> 
                      <span className="flex-1 text-left">Arquivar (remover do board principal)</span>
                      {list.automations?.some(a => a.type === 'archive') && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </button>

                    <button onClick={() => toggleAutomationType('trash')}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 text-xs rounded-lg border transition-all active:scale-[0.98]",
                        list.automations?.some(a => a.type === 'trash') 
                          ? "bg-destructive/10 border-destructive text-destructive font-bold shadow-sm" 
                          : "bg-secondary/30 border-border/50 hover:border-border hover:bg-secondary/50 text-foreground/80"
                      )}>
                      <Trash2 className="h-4 w-4" /> 
                      <span className="flex-1 text-left">Mover para lixeira</span>
                      {list.automations?.some(a => a.type === 'trash') && <div className="h-2 w-2 rounded-full bg-destructive" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-border">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-1">Campos dinâmicos</p>
                  
                  {/* Milestones */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-lg border border-border/50 focus-within:border-primary transition-colors">
                      <div className="p-1.5 rounded bg-background text-muted-foreground">
                        <CheckSquare className="h-3.5 w-3.5" />
                      </div>
                      <input 
                        value={milestoneInput} 
                        onChange={e => setMilestoneInput(e.target.value)} 
                        onKeyDown={e => { if (e.key === 'Enter' && milestoneInput.trim()) toggleAutomationType('mark-milestone', undefined, milestoneInput.trim()); }} 
                        placeholder="Concluir etapa: ex. Planejamento" 
                        className="flex-1 bg-transparent border-none outline-none text-xs placeholder:text-muted-foreground/60" 
                      />
                      <button 
                        onClick={() => { if (milestoneInput.trim()) toggleAutomationType('mark-milestone', undefined, milestoneInput.trim()); }}
                        className="p-1 px-2 rounded bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 transition-colors"
                      >
                        ADD
                      </button>
                    </div>
                    {list.automations?.filter(a => a.type === 'mark-milestone').map(a => (
                      <div key={a.targetMilestoneTitle} className="flex items-center justify-between px-3 py-2 text-xs bg-primary/5 rounded-lg border border-primary/20 group">
                        <span className="text-foreground flex items-center gap-2 font-medium">
                          <CheckSquare className="h-3 w-3 text-primary" /> 
                          {a.targetMilestoneTitle}
                        </span>
                        <button onClick={() => toggleAutomationType('mark-milestone', undefined, a.targetMilestoneTitle)} className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Label */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-lg border border-border/50 focus-within:border-primary transition-colors">
                      <div className="p-1.5 rounded bg-background text-muted-foreground">
                        <Tag className="h-3.5 w-3.5" />
                      </div>
                      <input 
                        value={labelAddInput} 
                        onChange={e => setLabelAddInput(e.target.value.toUpperCase())} 
                        onKeyDown={e => { if (e.key === 'Enter' && labelAddInput.trim()) toggleAutomationType('add-label', undefined, undefined, labelAddInput.trim().toUpperCase()); }} 
                        placeholder="Adicionar etiqueta: ex. URGENTE" 
                        className="flex-1 bg-transparent border-none outline-none text-xs placeholder:text-muted-foreground/60 uppercase" 
                      />
                      <button 
                         onClick={() => { if (labelAddInput.trim()) toggleAutomationType('add-label', undefined, undefined, labelAddInput.trim().toUpperCase()); }}
                         className="p-1 px-2 rounded bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 transition-colors"
                      >
                        ADD
                      </button>
                    </div>
                    {list.automations?.filter(a => a.type === 'add-label').map(a => (
                      <div key={a.targetLabelName} className="flex items-center justify-between px-3 py-2 text-xs bg-green-500/5 rounded-lg border border-green-500/20 group">
                        <span className="text-foreground flex items-center gap-2 font-medium">
                          <Tag className="h-3 w-3 text-green-500" /> 
                          {a.targetLabelName}
                        </span>
                        <button onClick={() => toggleAutomationType('add-label', undefined, undefined, a.targetLabelName)} className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Remove Label */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-lg border border-border/50 focus-within:border-destructive transition-colors">
                      <div className="p-1.5 rounded bg-background text-muted-foreground">
                        <Tag className="h-3.5 w-3.5" />
                      </div>
                      <input 
                        value={labelRemoveInput} 
                        onChange={e => setLabelRemoveInput(e.target.value.toUpperCase())} 
                        onKeyDown={e => { if (e.key === 'Enter' && labelRemoveInput.trim()) toggleAutomationType('remove-label', undefined, undefined, labelRemoveInput.trim().toUpperCase()); }} 
                        placeholder="Remover etiqueta: ex. REVISÃO" 
                        className="flex-1 bg-transparent border-none outline-none text-xs placeholder:text-muted-foreground/60 uppercase" 
                      />
                      <button 
                        onClick={() => { if (labelRemoveInput.trim()) toggleAutomationType('remove-label', undefined, undefined, labelRemoveInput.trim().toUpperCase()); }}
                        className="p-1 px-2 rounded bg-destructive text-destructive-foreground text-[10px] font-bold hover:bg-destructive/90 transition-colors"
                      >
                        REMOVER
                      </button>
                    </div>
                    {list.automations?.filter(a => a.type === 'remove-label').map(a => (
                      <div key={a.targetLabelName} className="flex items-center justify-between px-3 py-2 text-xs bg-red-500/5 rounded-lg border border-red-500/20 group">
                        <span className="text-foreground flex items-center gap-2 font-medium">
                          <Tag className="h-3 w-3 text-red-500" /> 
                          {a.targetLabelName}
                        </span>
                        <button onClick={() => toggleAutomationType('remove-label', undefined, undefined, a.targetLabelName)} className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {boards.filter(b => b.id !== list.boardId).length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-1">Mover para Board</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {boards.filter(b => b.id !== list.boardId).map(b => (
                        <button key={b.id}
                          onClick={() => { toggleAutomationType('move-to-board', b.id); }}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg border transition-all active:scale-[0.98]",
                            list.automations?.some(a => a.type === 'move-to-board' && a.targetBoardId === b.id)
                              ? "bg-primary/10 border-primary text-primary font-bold"
                              : "bg-secondary/20 border-border/50 hover:border-border text-foreground/80 hover:bg-secondary/40"
                          )}>
                          <ArrowRight className="h-3 w-3" />
                          <div className="w-3 h-3 rounded-sm shadow-inner" style={{ background: b.backgroundColor }} />
                          <span className="flex-1 text-left">{b.name}</span>
                          {list.automations?.some(a => a.type === 'move-to-board' && a.targetBoardId === b.id) && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-between">
                {list.automations && list.automations.length > 0 ? (
                  <button onClick={() => { if(window.confirm('Deseja remover todas as configurações desta lista?')) { updateList(list.id, { automations: undefined }); setShowAutomation(false); } }}
                    className="text-[10px] text-destructive hover:underline font-bold uppercase tracking-tight">
                    Resetar Lista
                  </button>
                ) : <div />}
                
                <button 
                  onClick={() => setShowAutomation(false)}
                  className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
                >
                  Concluir
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* Cards */}
      <div className="flex-1 min-h-[50px] overflow-y-auto px-1 custom-scrollbar w-full">
        <Droppable droppableId={list.id} type="CARD">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex-1 min-h-[100px] h-full p-1.5 rounded-md flex flex-col gap-2 transition-colors duration-200 ${snapshot.isDraggingOver ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
            >
              {listCards.map((card, index) => (
                <Draggable key={card.id} draggableId={card.id} index={index}>
                  {(provided, snapshot) => {
                    const child = (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={snapshot.isDragging ? 'shadow-2xl ring-2 ring-primary/50 relative z-50 rounded-md cursor-grabbing bg-card' : 'transition-[box-shadow] hover:shadow-md'}
                        style={provided.draggableProps.style}
                      >
                        <KanbanCardComponent card={card} listColor={list.color} onClick={() => onCardClick(card.id)} />
                      </div>
                    );

                    // Keep it in the portal even during drop animation to avoid it jumping back to the scaled DOM unscaled
                    if (snapshot.isDragging || snapshot.isDropAnimating) {
                      return ReactDOM.createPortal(child, document.body);
                    }
                    return child;
                  }}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>

      <div className="p-1">
        {adding ? (
          <div className="mt-1">
            <textarea
              id={`list-new-card-${list.id}`}
              name="newCardTitle"
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } if (e.key === 'Escape') setAdding(false); }}
              placeholder="Título do cartão..."
              className="w-full bg-card rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary resize-none"
              rows={2}
            />
            <div className="flex gap-2 mt-1 px-1 pb-1">
              <button onClick={handleAdd} className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium hover:bg-primary/90 transition-colors">
                Adicionar
              </button>
              <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">×</button>
            </div>
          </div>
        ) : (
          (currentUser?.role === 'ADMIN' || currentUser?.permissions?.canEdit) && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 w-full px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar cartão
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default KanbanListComponent;
