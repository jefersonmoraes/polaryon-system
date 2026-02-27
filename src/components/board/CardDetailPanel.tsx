import { useKanbanStore } from '@/store/kanban-store';
import { PREDEFINED_LABEL_COLORS } from '@/types/kanban';
import { X, Calendar, Tag, CheckSquare, MessageSquare, Clock, Trash2, Plus, Play, Square, RotateCcw, FileText, User, Timer, AlignLeft } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  cardId: string;
  onClose: () => void;
}

const CardDetailPanel = ({ cardId, onClose }: Props) => {
  const {
    cards, labels, lists, updateCard, deleteCard,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem,
    addComment, startTimer, stopTimer, resetTimer,
    addLabel, updateLabel, deleteLabel,
  } = useKanbanStore();
  const card = cards.find(c => c.id === cardId);
  const list = card ? lists.find(l => l.id === card.listId) : null;

  const [title, setTitle] = useState(card?.title || '');
  const [summary, setSummary] = useState(card?.summary || '');
  const [description, setDescription] = useState(card?.description || '');
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [showLabels, setShowLabels] = useState(false);
  const [dueDate, setDueDate] = useState(card?.dueDate || '');
  const [startDate, setStartDate] = useState(card?.startDate || '');
  const [assignee, setAssignee] = useState(card?.assignee || '');
  const [estimatedTime, setEstimatedTime] = useState(card?.estimatedTime?.toString() || '');
  
  // Label editor
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#3b82f6');
  const [labelHex, setLabelHex] = useState('#3b82f6');
  const [editLabelId, setEditLabelId] = useState<string | null>(null);

  // Timer display
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');
  const activeEntry = card?.timeEntries.find(e => !e.endedAt);
  const intervalRef = useRef<number>();

  useEffect(() => {
    if (activeEntry) {
      const update = () => {
        const elapsed = Math.floor((Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000);
        const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
        const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
        const s = (elapsed % 60).toString().padStart(2, '0');
        setTimerDisplay(`${h}:${m}:${s}`);
      };
      update();
      intervalRef.current = window.setInterval(update, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [activeEntry]);

  if (!card) return null;

  const handleSaveTitle = () => { if (title.trim()) updateCard(cardId, { title: title.trim() }); };
  const handleSaveSummary = () => updateCard(cardId, { summary });
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
  const handleSetDueDate = (val: string) => { setDueDate(val); updateCard(cardId, { dueDate: val || undefined }); };
  const handleSetStartDate = (val: string) => { setStartDate(val); updateCard(cardId, { startDate: val || undefined }); };
  const handleSetAssignee = (val: string) => { setAssignee(val); updateCard(cardId, { assignee: val || undefined }); };
  const handleSetEstimatedTime = (val: string) => {
    setEstimatedTime(val);
    updateCard(cardId, { estimatedTime: val ? parseInt(val) : undefined });
  };
  const handleSaveLabel = () => {
    if (!labelName.trim()) return;
    if (editLabelId) {
      updateLabel(editLabelId, { name: labelName.trim(), color: labelColor });
    } else {
      addLabel(labelName.trim(), labelColor);
    }
    setLabelName(''); setLabelColor('#3b82f6'); setLabelHex('#3b82f6');
    setEditingLabel(false); setEditLabelId(null);
  };
  const handleEditLabel = (label: { id: string; name: string; color: string }) => {
    setEditLabelId(label.id);
    setLabelName(label.name);
    setLabelColor(label.color);
    setLabelHex(label.color);
    setEditingLabel(true);
  };
  const handleColorHexChange = (hex: string) => {
    setLabelHex(hex);
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) setLabelColor(hex);
  };

  const checkDone = card.checklist.filter(i => i.completed).length;
  const checkTotal = card.checklist.length;
  const totalTimeSecs = card.timeEntries.reduce((t, e) => t + e.duration, 0);
  const totalH = Math.floor(totalTimeSecs / 3600);
  const totalM = Math.floor((totalTimeSecs % 3600) / 60);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl bg-background border-l border-border overflow-y-auto"
        >
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">em {list?.title || 'Lista'}</p>
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

            {/* Summary */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <FileText className="h-3.5 w-3.5" />
                Resumo
              </label>
              <input
                value={summary}
                onChange={e => setSummary(e.target.value)}
                onBlur={handleSaveSummary}
                placeholder="Breve resumo da tarefa..."
                className="w-full bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary"
              />
            </div>

            {/* Labels */}
            <div>
              <button onClick={() => setShowLabels(!showLabels)} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2 hover:text-foreground transition-colors">
                <Tag className="h-3.5 w-3.5" />
                Etiquetas
              </button>
              {card.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {labels.filter(l => card.labels.includes(l.id)).map(label => (
                    <span key={label.id} className="text-[10px] font-medium px-2 py-0.5 rounded text-white" style={{ backgroundColor: label.color }}>
                      {label.name}
                    </span>
                  ))}
                </div>
              )}
              {showLabels && (
                <div className="p-3 bg-secondary rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {labels.map(label => (
                      <div key={label.id} className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleLabel(label.id)}
                          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-medium text-white transition-all ${card.labels.includes(label.id) ? 'ring-2 ring-foreground' : ''}`}
                          style={{ backgroundColor: label.color }}
                        >
                          {label.name}
                        </button>
                        <button onClick={() => handleEditLabel(label)} className="p-1 rounded hover:bg-background/50 text-muted-foreground">
                          <FileText className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Label editor */}
                  <button onClick={() => { setEditingLabel(true); setEditLabelId(null); setLabelName(''); setLabelColor('#3b82f6'); setLabelHex('#3b82f6'); }}
                    className="text-[11px] text-primary hover:underline">
                    + Criar nova etiqueta
                  </button>
                  {editingLabel && (
                    <div className="p-2 bg-background rounded-lg border border-border space-y-2">
                      <input value={labelName} onChange={e => setLabelName(e.target.value)} placeholder="Nome da etiqueta"
                        className="w-full bg-secondary rounded px-2 py-1 text-xs outline-none border border-border focus:border-primary" />
                      {/* Predefined colors */}
                      <div className="flex flex-wrap gap-1">
                        {PREDEFINED_LABEL_COLORS.map(c => (
                          <button key={c} onClick={() => { setLabelColor(c); setLabelHex(c); }}
                            className={`w-5 h-5 rounded-sm transition-transform hover:scale-110 ${labelColor === c ? 'ring-2 ring-foreground ring-offset-1' : ''}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      {/* HEX input */}
                      <div className="flex gap-2 items-center">
                        <label className="text-[10px] text-muted-foreground">HEX:</label>
                        <input value={labelHex} onChange={e => handleColorHexChange(e.target.value)} maxLength={7}
                          className="w-20 bg-secondary rounded px-2 py-1 text-xs outline-none border border-border font-mono" />
                        <div className="w-6 h-6 rounded border border-border" style={{ backgroundColor: labelColor }} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveLabel} className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">
                          {editLabelId ? 'Salvar' : 'Criar'}
                        </button>
                        <button onClick={() => setEditingLabel(false)} className="text-xs text-muted-foreground">Cancelar</button>
                        {editLabelId && (
                          <button onClick={() => { deleteLabel(editLabelId); setEditingLabel(false); setEditLabelId(null); }}
                            className="text-xs text-destructive ml-auto">Excluir</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Assignee */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <User className="h-3.5 w-3.5" />
                Responsável
              </label>
              <input
                value={assignee}
                onChange={e => setAssignee(e.target.value)}
                onBlur={() => handleSetAssignee(assignee)}
                placeholder="Email do responsável..."
                className="w-full bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Data de Início
                </label>
                <input type="date" value={startDate} onChange={e => handleSetStartDate(e.target.value)}
                  className="w-full bg-secondary rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Data de Entrega
                </label>
                <input type="date" value={dueDate} onChange={e => handleSetDueDate(e.target.value)}
                  className="w-full bg-secondary rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary" />
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={card.completed} onChange={() => updateCard(cardId, { completed: !card.completed })} className="rounded" />
              Concluída
            </label>

            {/* Estimated time */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <Timer className="h-3.5 w-3.5" />
                Estimativa de Tempo (minutos)
              </label>
              <input type="number" value={estimatedTime} onChange={e => handleSetEstimatedTime(e.target.value)}
                placeholder="Ex: 120"
                className="w-32 bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary" />
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <AlignLeft className="h-3.5 w-3.5" />
                Descrição
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={handleSaveDesc}
                placeholder="Adicione uma descrição detalhada... Use **negrito**, *itálico*, - listas..."
                className="w-full bg-secondary rounded-lg px-3 py-2 text-xs outline-none border border-border focus:border-primary min-h-[120px] resize-y font-mono"
              />
            </div>

            {/* Checklist */}
            <div>
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
                    <input type="checkbox" checked={item.completed} onChange={() => toggleChecklistItem(cardId, item.id)} className="rounded" />
                    <span className={`flex-1 text-xs ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.text}</span>
                    <button onClick={() => deleteChecklistItem(cardId, item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-secondary transition-all">
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCheckItem()} placeholder="Novo item..."
                  className="flex-1 bg-secondary rounded px-2 py-1 text-xs outline-none border border-border focus:border-primary" />
                <button onClick={handleAddCheckItem} className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Timer */}
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <Clock className="h-3.5 w-3.5" />
                Rastreador de Tempo
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {activeEntry ? (
                  <>
                    <span className="text-xl font-mono font-bold text-accent">{timerDisplay}</span>
                    <button onClick={() => stopTimer(cardId)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors">
                      <Square className="h-3 w-3" /> Parar
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startTimer(cardId)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                      <Play className="h-3 w-3" /> Iniciar
                    </button>
                    <button onClick={() => resetTimer(cardId)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
                      <RotateCcw className="h-3 w-3" /> Resetar
                    </button>
                  </>
                )}
                {totalTimeSecs > 0 && (
                  <span className="text-xs text-muted-foreground">Total: {totalH}h {totalM}min</span>
                )}
                {card.estimatedTime && (
                  <span className="text-xs text-muted-foreground">Estimado: {card.estimatedTime}min</span>
                )}
              </div>
            </div>

            {/* Comments */}
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Comentários ({card.comments.length})
              </div>
              <div className="flex gap-2 mb-3">
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                  placeholder="Escreva um comentário... Use @nome para mencionar"
                  className="flex-1 bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary resize-none min-h-[50px]" />
                <button onClick={handleAddComment} className="self-end px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
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
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap">{comment.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete */}
            <div className="pt-4 border-t border-border">
              <button onClick={() => { deleteCard(cardId); onClose(); }}
                className="flex items-center gap-2 text-xs text-destructive hover:bg-destructive/10 px-3 py-2 rounded transition-colors">
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
