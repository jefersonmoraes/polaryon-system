import { useMemo } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, KanbanList } from '@/types/kanban';
import { Clock, MessageSquare, Paperclip, CheckSquare } from 'lucide-react';
import { useState } from 'react';

interface Props {
    boardId: string;
    onCardClick: (cardId: string) => void;
    sortBy: 'default' | 'priority' | 'assignee' | 'dueDate';
}

export const BoardListView = ({ boardId, onCardClick, sortBy }: Props) => {
    const { cards, lists, members: allMembers, labels } = useKanbanStore();
    const members = useMemo(() => (allMembers || []).filter(m => 
        m &&
        !(m.email || '').toLowerCase().includes('jjcorporation') && 
        !(m.name || '').toLowerCase().includes('jjcorporation')
    ), [allMembers]);

    const boardLists = lists.filter(l => l.boardId === boardId && !l.archived && !l.trashed);
    const boardCards = cards.filter(c => boardLists.some(l => l.id === c.listId) && !c.archived && !c.trashed);

    const getCardPriority = (card: Card) => {
        const cardLabels = labels.filter(l => card.labels.includes(l.id));
        if (cardLabels.some(l => l.name.toLowerCase().includes('urgent') || l.color === '#ef4444')) return 1;
        if (cardLabels.some(l => l.name.toLowerCase().includes('important') || l.color === '#f97316')) return 2;
        if (cardLabels.some(l => l.color === '#eab308')) return 3;
        if (cardLabels.some(l => l.color === '#22c55e')) return 5;
        if (cardLabels.length > 0) return 4;
        return 99;
    };

    const sortedCards = [...boardCards].sort((a, b) => {
        if (sortBy === 'dueDate') {
            if (!a.dueDate && !b.dueDate) return a.createdAt.localeCompare(b.createdAt);
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (sortBy === 'assignee') {
            if (!a.assignee && !b.assignee) return a.createdAt.localeCompare(b.createdAt);
            if (!a.assignee) return 1;
            if (!b.assignee) return -1;
            return a.assignee.localeCompare(b.assignee);
        }
        if (sortBy === 'priority') {
            const pA = getCardPriority(a);
            const pB = getCardPriority(b);
            if (pA !== pB) return pA - pB;
            return a.createdAt.localeCompare(b.createdAt);
        }
        // Default: Sort by list position, then card position
        const listA = boardLists.find(l => l.id === a.listId);
        const listB = boardLists.find(l => l.id === b.listId);
        if (listA && listB && listA.position !== listB.position) {
            return listA.position - listB.position;
        }
        return a.position - b.position;
    });

    return (
        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
            {boardLists.map(list => {
                const listCards = sortedCards.filter(c => c.listId === list.id);
                if (listCards.length === 0) return null;

                return (
                    <div key={list.id} className="mb-6">
                        <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: list.color || 'inherit' }}>
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: list.color || 'hsl(var(--primary))' }} />
                            {list.icon && <span>{list.icon}</span>}
                            {list.title}
                            <span className="text-xs text-muted-foreground font-normal">({listCards.length})</span>
                        </h3>
                        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden min-w-[800px]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground w-[40%]">Tarefa</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground">Responsável</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground">Prazo</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {listCards.map(card => {
                                        const assignee = members.find(m => m.id === card.assignee);
                                        const cardLabels = labels.filter(l => card.labels.includes(l.id));

                                        return (
                                            <tr
                                                key={card.id}
                                                onClick={() => onCardClick(card.id)}
                                                className="hover:bg-muted/30 transition-colors cursor-pointer group"
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-foreground group-hover:text-primary transition-colors">{card.title}</span>
                                                            {cardLabels.length > 0 && (
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    {cardLabels.map(l => (
                                                                        <span key={l.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} title={l.name} />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {assignee ? (
                                                        <div className="flex items-center gap-2" title={assignee.name}>
                                                            <img src={assignee.avatar} alt={assignee.name} className="w-6 h-6 rounded-full object-cover" />
                                                            <span className="text-xs text-muted-foreground">{assignee.name.split(' ')[0]}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">Não atribuído</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    {card.dueDate ? (
                                                        <span className="flex items-center gap-1 text-muted-foreground">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {new Date(card.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-3 text-muted-foreground text-xs">
                                                        {(card.attachments?.length || 0) > 0 && (
                                                            <span className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> {card.attachments?.length}</span>
                                                        )}
                                                        {(card.comments?.length || 0) > 0 && (
                                                            <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {card.comments?.length}</span>
                                                        )}
                                                        {(card.checklist?.length || 0) > 0 && (
                                                            <span className="flex items-center gap-1"><CheckSquare className="h-3.5 w-3.5" /> {card.checklist?.filter(i => i.completed).length || 0}/{card.checklist?.length || 0}</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}

            {boardCards.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                    Nenhuma tarefa encontrada neste board.
                </div>
            )}
        </div>
    );
};
