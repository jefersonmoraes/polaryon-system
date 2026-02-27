import { useKanbanStore } from '@/store/kanban-store';
import { Card } from '@/types/kanban';
import { X, Calendar, Tag, CheckSquare, MessageSquare, Clock, Trash2, Plus, Play, Square } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LABEL_COLOR_MAP: Record<string, string> = {
  green: 'bg-label-green', yellow: 'bg-label-yellow', orange: 'bg-label-orange',
  red: 'bg-label-red', purple: 'bg-label-purple', blue: 'bg-label-blue',
  teal: 'bg-label-teal', pink: 'bg-label-pink',
};

interface Props {
  cardId: string;
  onClose: () => void;
}

const CardDetailPanel = ({ cardId, onClose }: Props) => {
  const {
    cards, labels, lists, updateCard, deleteCard,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem,
    addComment, startTimer, stopTimer,
  } = useKanbanStore();
  const card = cards.find(c => c.id === cardId);
  const list = card ? lists.find(l => l.id === card.listId) : null;

  const [title, setTitle] = useState(card?.title || '');
  const [description, setDescription] = useState(card?.description || '');
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [showLabels, setShowLabels] = useState(false);
  const [dueDate, setDueDate] = useState(card?.dueDate || '');

  // Timer display
  const [timerDisplay, setTimerDisplay] = useState('00:00');
  const activeEntry = card?.timeEntries.find(e => !e.endedAt);
  const intervalRef = useRef<number>();

  useEffect(() => {
    if (activeEntry) {
      intervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000);
        const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const s = (elapsed % 60).toString().padStart(2, '0');
        setTimerDisplay(`${m}:${s}`);
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [activeEntry]);

  if (!card) return null;

  const handleSaveTitle = () => { if (title.trim()) updateCard(cardId, { title: title.trim() }); };
  const handleSaveDesc = () => updateCard(cardId, { description });
  const handleToggleLabel = (labelId: string) => {
    const next = card.labels.includes(labelId)
      ? card.labels.filter(l => l !== labelId)
      : [...card.labels, labelId];
    updateCard(cardId, { labels: next });
  };
  const handleAddCheckItem = () => {
    if (newCheckItem.trim()) { addChecklistItem(cardId, newCheckItem.trim()); setNewCheckItem(''); }
  };
  const handleAddComment = () => {
    if (newComment.trim()) { addComment(cardId, newComment.trim()); setNewComment(''); }
  };
  const handleSetDueDate = (val: string) => {
    setDueDate(val);
    updateCard(cardId, { dueDate: val || undefined });
  };
  const checkDone = card.checklist.filter(i => i.completed).length;
  const checkTotal = card.checklist.length;
  const totalTimeSecs = card.timeEntries.reduce((t, e) => t + e.duration, 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end"
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />

        {/* Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-background border-l border-border overflow-y-auto"
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  em {list?.title || 'Lista'}
                </p>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
                  className="w-full text-lg font-bold bg-transparent outline-none border-b border-transparent focus:border-primary pb-1"
                />
              </div>
              <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary transition-colors ml-2">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Labels */}
            <div className="mb-5">
              <button onClick={() => setShowLabels(!showLabels)} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2 hover:text-foreground transition-colors">
                <Tag className="h-3.5 w-3.5" />
                Etiquetas
              </button>
              {card.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {labels.filter(l => card.labels.includes(l.id)).map(label => (
                    <span key={label.id} className={`text-[10px] font-medium px-2 py-0.5 rounded ${LABEL_COLOR_MAP[label.color] || 'bg-primary'}`} style={{ color: '#fff' }}>
                      {label.name}
                    </span>
                  ))}
                </div>
              )}
              {showLabels && (
                <div className="grid grid-cols-2 gap-1.5 p-2 bg-secondary rounded-lg">
                  {labels.map(label => (
                    <button
                      key={label.id}
                      onClick={() => handleToggleLabel(label.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-medium transition-colors ${
                        card.labels.includes(label.id) ? 'ring-2 ring-primary' : ''
                      } ${LABEL_COLOR_MAP[label.color] || 'bg-primary'}`}
                      style={{ color: '#fff' }}
                    >
                      {label.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Due date */}
            <div className="mb-5">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <Calendar className="h-3.5 w-3.5" />
                Data de Entrega
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => handleSetDueDate(e.target.value)}
                  className="bg-secondary rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={card.completed}
                    onChange={() => updateCard(cardId, { completed: !card.completed })}
                    className="rounded"
                  />
                  Concluída
                </label>
              </div>
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={handleSaveDesc}
                placeholder="Adicione uma descrição mais detalhada..."
                className="w-full bg-secondary rounded-lg px-3 py-2 text-xs outline-none border border-border focus:border-primary min-h-[80px] resize-y"
              />
            </div>

            {/* Checklist */}
            <div className="mb-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <CheckSquare className="h-3.5 w-3.5" />
                Checklist
                {checkTotal > 0 && <span className="text-[10px] font-normal">({checkDone}/{checkTotal})</span>}
              </div>
              {checkTotal > 0 && (
                <div className="h-1.5 bg-secondary rounded-full mb-2 overflow-hidden">
                  <div className="h-full bg-label-green rounded-full transition-all" style={{ width: `${(checkDone / checkTotal) * 100}%` }} />
                </div>
              )}
              <div className="space-y-1 mb-2">
                {card.checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleChecklistItem(cardId, item.id)}
                      className="rounded"
                    />
                    <span className={`flex-1 text-xs ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {item.text}
                    </span>
                    <button
                      onClick={() => deleteChecklistItem(cardId, item.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-secondary transition-all"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  value={newCheckItem}
                  onChange={e => setNewCheckItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCheckItem()}
                  placeholder="Novo item..."
                  className="flex-1 bg-secondary rounded px-2 py-1 text-xs outline-none border border-border focus:border-primary"
                />
                <button onClick={handleAddCheckItem} className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Timer */}
            <div className="mb-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <Clock className="h-3.5 w-3.5" />
                Rastreador de Tempo
              </div>
              <div className="flex items-center gap-3">
                {activeEntry ? (
                  <>
                    <span className="text-lg font-mono font-bold text-accent">{timerDisplay}</span>
                    <button onClick={() => stopTimer(cardId)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors">
                      <Square className="h-3 w-3" /> Parar
                    </button>
                  </>
                ) : (
                  <>
                    {totalTimeSecs > 0 && (
                      <span className="text-xs text-muted-foreground">Total: {Math.round(totalTimeSecs / 60)}min</span>
                    )}
                    <button onClick={() => startTimer(cardId)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                      <Play className="h-3 w-3" /> Iniciar
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Comments */}
            <div className="mb-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Comentários ({card.comments.length})
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  placeholder="Escreva um comentário..."
                  className="flex-1 bg-secondary rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary"
                />
                <button onClick={handleAddComment} className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                  Enviar
                </button>
              </div>
              <div className="space-y-2">
                {card.comments.slice().reverse().map(comment => (
                  <div key={comment.id} className="bg-secondary rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center text-[9px] font-bold text-accent-foreground">
                        {comment.author[0]}
                      </div>
                      <span className="text-[11px] font-medium">{comment.author}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/80">{comment.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete */}
            <div className="pt-4 border-t border-border">
              <button
                onClick={() => { deleteCard(cardId); onClose(); }}
                className="flex items-center gap-2 text-xs text-destructive hover:bg-destructive/10 px-3 py-2 rounded transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir cartão
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CardDetailPanel;
