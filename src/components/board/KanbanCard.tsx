import { Card } from '@/types/kanban';
import { useKanbanStore } from '@/store/kanban-store';
import { CheckSquare, Calendar, MessageSquare, Paperclip, Clock } from 'lucide-react';

const LABEL_COLOR_MAP: Record<string, string> = {
  green: 'bg-label-green',
  yellow: 'bg-label-yellow',
  orange: 'bg-label-orange',
  red: 'bg-label-red',
  purple: 'bg-label-purple',
  blue: 'bg-label-blue',
  teal: 'bg-label-teal',
  pink: 'bg-label-pink',
};

interface Props {
  card: Card;
  onClick: () => void;
}

const KanbanCardComponent = ({ card, onClick }: Props) => {
  const { labels } = useKanbanStore();
  const cardLabels = labels.filter(l => card.labels.includes(l.id));
  const checkDone = card.checklist.filter(i => i.completed).length;
  const checkTotal = card.checklist.length;
  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date() && !card.completed;

  return (
    <div className="kanban-card" onClick={onClick}>
      {/* Labels */}
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {cardLabels.map(label => (
            <span
              key={label.id}
              className={`label-dot text-[9px] font-medium px-1.5 py-0.5 rounded-sm ${LABEL_COLOR_MAP[label.color] || 'bg-primary'}`}
              style={{ color: '#fff', minWidth: 'auto' }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-xs font-medium leading-snug">{card.title}</p>

      {/* Metadata */}
      {(card.dueDate || checkTotal > 0 || card.comments.length > 0 || card.attachments.length > 0 || card.timeEntries.length > 0) && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {card.dueDate && (
            <span className={`flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded ${
              card.completed ? 'bg-label-green/20 text-label-green' : isOverdue ? 'bg-label-red/20 text-label-red' : 'text-muted-foreground'
            }`}>
              <Calendar className="h-2.5 w-2.5" />
              {new Date(card.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          )}
          {checkTotal > 0 && (
            <span className={`flex items-center gap-0.5 text-[10px] ${checkDone === checkTotal ? 'text-label-green' : 'text-muted-foreground'}`}>
              <CheckSquare className="h-2.5 w-2.5" />
              {checkDone}/{checkTotal}
            </span>
          )}
          {card.comments.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <MessageSquare className="h-2.5 w-2.5" />
              {card.comments.length}
            </span>
          )}
          {card.attachments.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Paperclip className="h-2.5 w-2.5" />
              {card.attachments.length}
            </span>
          )}
          {card.timeEntries.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {Math.round(card.timeEntries.reduce((t, e) => t + e.duration, 0) / 60)}m
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default KanbanCardComponent;
