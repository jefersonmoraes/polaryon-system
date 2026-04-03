import { Card } from '@/types/kanban';
import { useMemo } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { CheckSquare, Calendar, MessageSquare, Paperclip, Clock, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { hexToRgba, fixDateToBRT } from '@/lib/utils';

interface Props {
  card: Card;
  listColor?: string;
  onClick: () => void;
}

const KanbanCardComponent = ({ card, listColor, onClick }: Props) => {
  const { labels, members: allMembers, updateCard } = useKanbanStore();
  const members = allMembers || [];
  const { currentUser } = useAuthStore();
  const cardLabels = labels.filter(l => card.labels.includes(l.id));
  const assignedMember = members.find(m => 
    m.id === card.assignee || 
    (m.email && card.assignee && m.email.toLowerCase() === card.assignee.toLowerCase())
  );
  const checkDone = (card.checklist || []).filter(i => i.completed).length;
  const checkTotal = (card.checklist || []).length;
  const dueDateObj = fixDateToBRT(card.dueDate);
  const isOverdue = dueDateObj && dueDateObj < new Date() && !card.completed;
  const hasOverdueMilestone = card.milestones && card.milestones.some(m => {
    if (m.completed || !m.dueDate) return false;
    const msDate = fixDateToBRT(m.dueDate);
    return msDate && msDate < new Date();
  });

  if (card.archived || card.trashed) return null;

  // Find nearest incomplete milestone
  const nearestMilestone = card.milestones
    ?.filter(m => !m.completed && m.dueDate)
    .sort((a, b) => {
        const dateA = fixDateToBRT(a.dueDate!)?.getTime() || 0;
        const dateB = fixDateToBRT(b.dueDate!)?.getTime() || 0;
        return dateA - dateB;
    })[0];

  const cardStyle = listColor ? {
    backgroundColor: hexToRgba(listColor, 0.08), // softer background 
    borderColor: hexToRgba(listColor, 0.2) // softer border
  } : {};

  return (
    <div 
        className={`kanban-card group shadow-lg hover:shadow-xl transition-[box-shadow,border-color,background-color,transform] duration-200 backdrop-blur-sm border border-border/60 relative overflow-hidden ${card.completed ? 'opacity-70 grayscale-[0.3] bg-muted' : 'bg-card'}`} 
        style={cardStyle} 
        onClick={onClick}
        onMouseEnter={() => {
            const store = useKanbanStore.getState();
            // Pre-fetch details so they are ready when clicked
            if (!card.description) {
                store.fetchCardDetails(card.id).catch(() => {});
            }
        }}
    >
      {/* Title */}
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-bold leading-snug text-foreground ${card.completed ? 'line-through text-muted-foreground' : ''}`}>{card.title}</p>

        {/* Toggle Completed Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit) {
              toast.error('Você não tem permissão para editar cartões.');
              return;
            }
            updateCard(card.id, { completed: !card.completed });
          }}
          className={`shrink-0 p-1.5 rounded-full transition-colors border ${card.completed ? 'bg-label-green text-white border-label-green' : 'bg-secondary/50 text-muted-foreground border-border hover:bg-label-green/20 hover:text-label-green hover:border-label-green/50 opacity-0 group-hover:opacity-100'}`}
          title={card.completed ? 'Marcar como não concluída' : 'Marcar como concluída'}
        >
          <CheckSquare className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Summary preview */}
      {card.summary && (
        <p 
          className="text-[10px] text-muted-foreground mt-1.5 leading-[1.5] overflow-hidden break-words whitespace-normal"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {card.summary}
        </p>
      )}

      {/* Dates & Nearest Milestone */}
      <div className="flex flex-col gap-1.5 mt-2">
        {nearestMilestone && (
          <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded font-bold shadow-sm ${fixDateToBRT(nearestMilestone.dueDate!)! < new Date() ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'}`}>
            <Calendar className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{nearestMilestone.title}</span>
            <span className="ml-auto flex-shrink-0 opacity-90">
              {fixDateToBRT(nearestMilestone.dueDate!)?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              {nearestMilestone.hour && ` às ${nearestMilestone.hour}`}
            </span>
          </div>
        )}

        {!nearestMilestone && card.dueDate && (
          <div className={`flex items-center w-max gap-1 text-[10px] px-2 py-1 rounded font-bold shadow-sm ${card.completed ? 'bg-label-green text-white' : isOverdue ? 'bg-red-500 text-white' : 'bg-secondary text-foreground'}`}>
            <Calendar className="h-3 w-3" />
            Entrega: {dueDateObj?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </div>
        )}
      </div>

      {/* Metadata */}
      {(checkTotal > 0 || (card.comments?.length || 0) > 0 || (card.attachments?.length || 0) > 0 || (card.timeEntries?.length || 0) > 0 || card.assignee || hasOverdueMilestone || (card.milestones && card.milestones.length > 0)) && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {hasOverdueMilestone && (
            <span className="flex items-center gap-0.5 text-[10px] text-label-red bg-label-red/10 px-1 py-0.5 rounded font-bold shadow-sm" title="Existem etapas (milestones) atrasadas neste cartão!">
              <Clock className="h-2.5 w-2.5" /> Atraso
            </span>
          )}
          {(card.milestones?.length || 0) > 0 && !hasOverdueMilestone && (
            <span className="flex items-center gap-0.5 text-[10px] text-blue-500 bg-blue-500/10 px-1 py-0.5 rounded font-bold" title={`${card.milestones?.filter(m => m.completed).length || 0}/${card.milestones?.length || 0} etapas concluídas`}>
              <CheckSquare className="h-2.5 w-2.5" /> {card.milestones?.filter(m => m.completed).length || 0}/{card.milestones?.length || 0}
            </span>
          )}
          {checkTotal > 0 && (
            <span className={`flex items-center gap-0.5 text-[10px] font-bold ${checkDone === checkTotal ? 'text-label-green' : 'text-foreground/70'}`}>
              <CheckSquare className="h-2.5 w-2.5" />
              {checkDone}/{checkTotal}
            </span>
          )}
          {(card.comments?.length || 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-foreground/70 font-bold">
              <MessageSquare className="h-2.5 w-2.5" />
              {card.comments?.length}
            </span>
          )}
          {(card.attachments?.length || 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-foreground/70 font-bold">
              <Paperclip className="h-2.5 w-2.5" />
              {card.attachments?.length}
            </span>
          )}
          {(card.timeEntries?.length || 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-foreground/70 font-bold">
              <Clock className="h-2.5 w-2.5" />
              {Math.round(card.timeEntries!.reduce((t, e) => t + e.duration, 0) / 60)}m
            </span>
          )}
          {assignedMember && (
            <div className="ml-auto" title={assignedMember.name}>
              <img src={assignedMember.avatar} alt={assignedMember.name} className="w-5 h-5 rounded-full object-cover border border-border" />
            </div>
          )}
        </div>
      )}

      {/* Labels - Moved to the bottom */}
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {cardLabels.map(label => (
            <span
              key={label.id}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${label.color}dd, ${label.color})` }}
            >
              {label.icon && <span>{label.icon}</span>}
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Creation date */}
      <div className="mt-2.5 pt-2 border-t border-border/30 text-[9px] text-muted-foreground font-medium opacity-80 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          Criada em {new Date(card.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        {card.completed && (
          <span className="text-label-green font-bold flex items-center gap-1"><CheckSquare className="w-2.5 h-2.5" /> Concluída</span>
        )}
      </div>
    </div>
  );
};

export default KanbanCardComponent;
