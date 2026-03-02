import { useKanbanStore } from '@/store/kanban-store';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import CardDetailPanel from '@/components/board/CardDetailPanel';

export default function GlobalCalendarPage() {
    const { cards, boards, lists, labels } = useKanbanStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

    const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');

    // Get all active cards
    const activeCards = cards.filter(c => !c.archived && !c.trashed);

    const getStartOfWeek = (date: Date) => {
        const d = new Date(date);
        const diff = d.getDate() - d.getDay();
        return new Date(d.setDate(diff));
    };

    const days: (Date | null)[] = [];
    if (viewType === 'month') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    } else if (viewType === 'week') {
        const start = getStartOfWeek(currentDate);
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
    } else if (viewType === 'day') {
        days.push(new Date(currentDate));
    }

    const handlePrev = () => {
        const newDate = new Date(currentDate);
        if (viewType === 'month') newDate.setMonth(newDate.getMonth() - 1);
        else if (viewType === 'week') newDate.setDate(newDate.getDate() - 7);
        else if (viewType === 'day') newDate.setDate(newDate.getDate() - 1);
        setCurrentDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(currentDate);
        if (viewType === 'month') newDate.setMonth(newDate.getMonth() + 1);
        else if (viewType === 'week') newDate.setDate(newDate.getDate() + 7);
        else if (viewType === 'day') newDate.setDate(newDate.getDate() + 1);
        setCurrentDate(newDate);
    };

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    let headerText = '';
    if (viewType === 'month') {
        headerText = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewType === 'week') {
        const start = getStartOfWeek(currentDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        headerText = `${start.getDate()} ${monthNames[start.getMonth()].substring(0, 3)} - ${end.getDate()} ${monthNames[end.getMonth()].substring(0, 3)}`;
    } else if (viewType === 'day') {
        headerText = `${currentDate.getDate()} de ${monthNames[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
    }

    // Find upcoming cards (next 7 days)
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const upcomingCards = activeCards.filter(c => {
        if (!c.dueDate && (!c.milestones || c.milestones.length === 0)) return false;

        // Check main due date
        if (c.dueDate) {
            const d = new Date(c.dueDate);
            if (d >= today && d <= nextWeek) return true;
        }

        // Check milestones
        if (c.milestones) {
            return c.milestones.some(m => m.dueDate && new Date(m.dueDate) >= today && new Date(m.dueDate) <= nextWeek && !m.completed);
        }

        return false;
    }).sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
        return dateA - dateB;
    }).slice(0, 10);

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Main Calendar Area */}
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                            <CalendarIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">Calendário Global</h1>
                            <p className="text-sm text-muted-foreground">Visão geral de todos os prazos</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex bg-secondary/50 rounded p-1 mr-4">
                            <button onClick={() => setViewType('month')} className={`px-3 py-1 text-xs font-semibold rounded ${viewType === 'month' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Mês</button>
                            <button onClick={() => setViewType('week')} className={`px-3 py-1 text-xs font-semibold rounded ${viewType === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Semana</button>
                            <button onClick={() => setViewType('day')} className={`px-3 py-1 text-xs font-semibold rounded ${viewType === 'day' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Dia</button>
                        </div>
                        <h3 className="text-xl font-bold text-foreground min-w-[180px] text-right">
                            {headerText}
                        </h3>
                        <div className="flex gap-2 ml-4">
                            <button onClick={handlePrev} className="p-2 rounded hover:bg-secondary text-muted-foreground transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 rounded bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">Hoje</button>
                            <button onClick={handleNext} className="p-2 rounded hover:bg-secondary text-muted-foreground transition-colors"><ChevronRight className="w-5 h-5" /></button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-card rounded-xl shadow-lg border border-border flex flex-col min-h-[500px]">
                    {viewType !== 'day' && (
                        <div className="grid grid-cols-7 border-b border-border bg-muted/30 shrink-0">
                            {weekDays.map(day => (
                                <div key={day} className="py-3 text-center text-sm font-bold text-muted-foreground uppercase tracking-wider">
                                    {day}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className={`flex-1 ${viewType === 'day' ? 'flex flex-col' : 'grid grid-cols-7 auto-rows-[minmax(120px,1fr)]'}`}>
                        {days.map((date, index) => {
                            if (!date) {
                                return <div key={`empty-${index}`} className="border-r border-b border-border/50 bg-muted/10 p-2" />;
                            }
                            const dateCards = activeCards.filter(c => {
                                // Match main due date or any milestone due date
                                const matchesMain = c.dueDate && new Date(c.dueDate).toDateString() === date.toDateString();
                                const matchesMilestone = c.milestones && c.milestones.some(m => m.dueDate && new Date(m.dueDate).toDateString() === date.toDateString());
                                return matchesMain || matchesMilestone;
                            });
                            const isToday = new Date().toDateString() === date.toDateString();

                            return (
                                <div key={date.toISOString()} className={`border-r border-b border-border/50 p-2 flex flex-col gap-1 overflow-hidden hover:bg-accent/5 transition-colors ${isToday ? 'bg-primary/5' : ''}`}>
                                    <div className="flex justify-between items-center mb-2 px-1">
                                        <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground'}`}>
                                            {date.getDate()}
                                        </span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 px-1">
                                        {dateCards.map(card => {
                                            const cardLabels = labels.filter(l => card.labels.includes(l.id));
                                            const primaryColor = cardLabels.length > 0 ? cardLabels[0].color : '#3b82f6';
                                            return (
                                                <div
                                                    key={card.id}
                                                    onClick={() => setSelectedCardId(card.id)}
                                                    className="text-xs truncate px-2 py-1.5 rounded-md cursor-pointer transition-all hover:opacity-80 text-white font-medium shadow-sm hover:translate-y-[-1px]"
                                                    style={{ backgroundColor: primaryColor }}
                                                    title={card.title}
                                                >
                                                    {card.title}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Upcomings Panel / Sidebar */}
            <div className="w-[320px] border-l border-border bg-card/50 flex flex-col shrink-0">
                <div className="p-4 border-b border-border bg-card">
                    <h2 className="font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Próximos Eventos</h2>
                    <p className="text-xs text-muted-foreground">Próximos 7 dias</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {upcomingCards.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento próximo.</p>
                    )}
                    {upcomingCards.map(card => {
                        const list = lists.find(l => l.id === card.listId);
                        const board = boards.find(b => b.id === list?.boardId);
                        return (
                            <div key={`upcoming-${card.id}`} onClick={() => setSelectedCardId(card.id)} className="p-3 bg-background rounded-lg border border-border shadow-sm hover:border-primary/50 cursor-pointer transition-all hover:shadow-md">
                                <p className="font-semibold text-sm line-clamp-2">{card.title}</p>
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1 w-max px-1.5 py-0.5 rounded bg-secondary">
                                        Em {board?.name}
                                    </span>
                                    {card.dueDate && <span className="text-primary font-medium">{new Date(card.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {selectedCardId && (
                <CardDetailPanel cardId={selectedCardId} onClose={() => setSelectedCardId(null)} />
            )}
        </div>
    );
}
