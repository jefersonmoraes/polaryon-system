import { Card } from '@/types/kanban';
import { useKanbanStore } from '@/store/kanban-store';
import { CheckSquare, Calendar, MessageSquare, Paperclip, Clock, User } from 'lucide-react';

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
  if (card.archived || card.trashed) return null;

  return (
    <div className="kanban-card" onClick={onClick}>
      {/* Labels with names */}
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {cardLabels.map(label => (
            <span
              key={label.id}
              className="text-[9px] font-medium px-1.5 py-0.5 rounded-sm text-white"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-xs font-medium leading-snug">{card.title}</p>
      
      {/* Summary preview */}
      {card.summary && (
        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{card.summary}</p>
      )}

      {/* Dates */}
      {(card.startDate || card.dueDate) && (
        <div className="flex items-center gap-2 mt-1.5">
          {card.startDate && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(card.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          )}
          {card.startDate && card.dueDate && <span className="text-[10px] text-muted-foreground">→</span>}
          {card.dueDate && (
            <span className={`flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded ${
              card.completed ? 'bg-label-green/20 text-label-green' : isOverdue ? 'bg-label-red/20 text-label-red' : 'text-muted-foreground'
            }`}>
              <Calendar className="h-2.5 w-2.5" />
              {new Date(card.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
      )}

      {/* Metadata */}
      {(checkTotal > 0 || card.comments.length > 0 || card.attachments.length > 0 || card.timeEntries.length > 0 || card.assignee) && (
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
          {card.assignee && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto" title={card.assignee}>
              <User className="h-2.5 w-2.5" />
              {card.assignee.split('@')[0]}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default KanbanCardComponent;
