import { useKanbanStore } from '@/store/kanban-store';
import { useAccountingStore } from '@/store/accounting-store';
import { useDocumentStore } from '@/store/document-store';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, HardDriveDownload, FileText, PiggyBank, Calculator } from 'lucide-react';
import CardDetailPanel from '@/components/board/CardDetailPanel';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import { toast } from 'sonner';
import { socketService } from '@/lib/socket';
import { fixDateToBRT } from '@/lib/utils';

export default function GlobalCalendarPage() {
    const { 
        cards, boards, lists, labels, budgets, googleEvents, 
        setGoogleEvents: originalSetGoogleEvents,
        fetchKanbanData, fetchBudgets
    } = useKanbanStore();
    const { documents } = useDocumentStore();
    const { taxObligations } = useAccountingStore();
    const { currentUser } = useAuthStore();

    useEffect(() => {
        fetchKanbanData();
        fetchBudgets();
    }, [fetchKanbanData, fetchBudgets]);

    const setGoogleEvents = (events: any[]) => {
        originalSetGoogleEvents(events);
    };

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

    const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');

    // Feriados da Brasil API
    const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);

    useEffect(() => {
        const year = currentDate.getFullYear();
        fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setHolidays(data);
            })
            .catch(() => console.error('Erro ao buscar feriados'));
    }, [currentDate.getFullYear()]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('sync') === 'success') {
            toast.success("Google Agenda Integrada! Sincronizando dados...", { duration: 5000 });
            window.history.replaceState({}, document.title, window.location.pathname);
            syncWithGoogleCalendar();
        } else {
            loadGoogleEvents();
        }

        // Real-time listener: refresh if anything relevant changes in other users/tabs
        const handleSync = (action: any) => {
            if (action.store === 'GOOGLE_CALENDAR' && action.type === 'SYNC_COMPLETE') {
                // Re-reload if needed or just trust the store update
            } else if (['DOCUMENTS', 'ACCOUNTING', 'KANBAN'].includes(action.store)) {
                setTimeout(loadGoogleEvents, 1000);
            }
        };

        socketService.on('system_sync', handleSync);
        return () => socketService.off('system_sync', handleSync);
    }, []);

    const loadGoogleEvents = async () => {
        try {
            const res = await api.get('/calendar/events');
            // Check for both success and the soft needsAuth status ⚒️🚀⚙️
            if (res.data.success && res.data.events) {
                setGoogleEvents(res.data.events);
            } else if (res.data.needsAuth) {
                console.log("GlobalCalendar: Google auth required. Use manual sync to link. ⚒️🚀⚙️");
            }
        } catch (err: any) {
            // Silently ignore Errors on passive load to keep console 100% clean ⚒️🚀⚙️
            if (process.env.NODE_ENV === 'development') {
                console.warn("Soft Google Load failed", err);
            }
        }
    };

    const syncWithGoogleCalendar = async () => {
        try {
            toast.loading("Sincronizando com G Agenda do Administrador...", { id: 'gcal' });

            // Push active tasks with due dates
            const cardEvents = cards.filter(c => !c.archived && !c.trashed && c.dueDate && !c.completed).map(c => ({
                id: c.id,
                title: `[Tarefa] ${c.title}`, // Changed prefix to be more user friendly
                date: c.dueDate
            }));

            // Push document expirations
            const docEvents = documents.filter(d => !d.trashed && d.expirationDate).map(d => ({
                id: d.id,
                title: `[Doc] ${d.title}`,
                date: d.expirationDate
            }));

            // Push tax obligations
            const taxEvents = taxObligations.filter(t => !t.trashedAt && t.dueDate && t.status === 'pending').map(t => ({
                id: t.id,
                title: `[Imposto] ${t.name}`,
                date: t.dueDate
            }));

            const eventsToPush = [...cardEvents, ...docEvents, ...taxEvents];

            const res = await api.post('/calendar/sync', { eventsToPush });

            if (res.data.success && res.data.events) {
                setGoogleEvents(res.data.events);
                toast.success("Conexão e sincronização concluída com sucesso!", { id: 'gcal' });
            } else if (res.data.needsAuth) {
                toast.dismiss('gcal');
                const authUrl = res.data.authUrl;
                toast.info("Aguarde, redirecionando para autorizar no Google de forma Segura...", { duration: 8000 });
                setTimeout(() => window.location.assign(authUrl), 1500);
            } else {
                toast.error("Servidor recusou a sincronização. Verifique os logs.", { id: 'gcal' });
            }
        } catch (err: any) {
            console.error("Calendar Sync Error:", err);
            if (err.response?.status === 401 && err.response?.data?.error === 'NEEDS_AUTH') {
                toast.dismiss('gcal');
                const authUrl = err.response.data.authUrl;
                toast.info("Redirecionando para renovar autorização...", { duration: 8000 });
                setTimeout(() => window.location.assign(authUrl), 1500);
            } else {
                toast.error("Falha de conexão com a API do Google Calendar.", { id: 'gcal' });
            }
        }
    };

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

    const fixDate = (dateParam: any) => {
        const d = fixDateToBRT(dateParam);
        return d || new Date(0);
    };

    const safeDateMatch = (dateParam: any, targetStr: string) => {
        if (!dateParam) return false;
        const d = fixDateToBRT(dateParam);
        if (!d || d.getTime() <= 0) return false;
        return d.toDateString() === targetStr;
    };

    // Find upcoming cards (next 10 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset today for comparison
    const nextLimit = new Date(today);
    nextLimit.setDate(today.getDate() + 10);
    nextLimit.setHours(23, 59, 59, 999);

    const upcomingCards = activeCards.filter(c => {
        if (!c.dueDate && (!c.milestones || c.milestones.length === 0)) return false;

        // Check main due date
        if (c.dueDate) {
            const d = fixDate(c.dueDate);
            if (d.getTime() > 0 && d >= today && d <= nextLimit) return true;
        }

        // Check milestones
        if (c.milestones) {
            return c.milestones.some(m => {
                if (!m.dueDate) return false;
                const d = fixDate(m.dueDate);
                return d.getTime() > 0 && d >= today && d <= nextLimit && !m.completed;
            });
        }

        return false;
    }).sort((a, b) => {
        const dateA = a.dueDate ? fixDate(a.dueDate).getTime() : 9999999999999;
        const dateB = b.dueDate ? fixDate(b.dueDate).getTime() : 9999999999999;
        return dateA - dateB;
    }).slice(0, 10);

    // Global Upcoming Events for the Sidebar
    const allUpcomingEvents = (() => {
        const events: any[] = [];
        
        // Use the already filtered and sliced upcomingCards
        upcomingCards.forEach(c => {
            if (c.dueDate) {
                const d = fixDate(c.dueDate);
                if (d.getTime() > 0) {
                    events.push({ id: c.id, title: `Tarefa: ${c.title}`, date: d, type: 'tarefa' });
                }
            }
        });

        documents.filter(d => {
            if (d.trashed || !d.expirationDate) return false;
            const dDate = fixDate(d.expirationDate);
            return dDate.getTime() > 0 && dDate >= today && dDate <= nextLimit;
        }).forEach(d => {
            events.push({ id: d.id, title: `Doc Expirando: ${d.title}`, date: fixDate(d.expirationDate), type: 'documento' });
        });

        taxObligations.filter(t => {
            if (t.trashedAt || t.status !== 'pending' || !t.dueDate) return false;
            const tDate = fixDate(t.dueDate);
            return tDate.getTime() > 0 && tDate >= today && tDate <= nextLimit;
        }).forEach(t => {
            events.push({ id: t.id, title: `Imposto Pendente: ${t.name}`, date: fixDate(t.dueDate), type: 'contabil' });
        });

        googleEvents.filter(g => {
            const gDate = fixDate(g.date);
            return gDate.getTime() > 0 && gDate >= today && gDate <= nextLimit;
        }).forEach(g => {
            if (g.title) {
                events.push({ id: g.id, title: g.title, date: fixDate(g.date), type: 'google' });
            }
        });

        return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 15);
    })();

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
                            <p className="text-muted-foreground text-sm font-medium">Controle unificado de prazos e eventos</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentUser?.email?.toLowerCase().startsWith('jjcorporation') && (
                            <button 
                                onClick={syncWithGoogleCalendar} 
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
                            >
                                <span className="w-4 h-4 rounded-full bg-white text-blue-600 flex items-center justify-center font-bold text-[10px]">G</span>
                                Sincronizar G Agenda
                            </button>
                        )}
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

                            const dateStr = date.toDateString();

                            // Tasks
                            const dateCards = activeCards.filter(c => {
                                const matchesMain = c.dueDate && safeDateMatch(c.dueDate, dateStr);
                                const matchesMilestone = c.milestones && c.milestones.some(m => m.dueDate && safeDateMatch(m.dueDate, dateStr));
                                return matchesMain || matchesMilestone;
                            });
                            // System Global metrics
                            const dateBudgets: any[] = []; // Removed by user request
                            const dateDocs = documents.filter(d => !d.trashed && safeDateMatch(d.expirationDate, dateStr));
                            const dateTaxes = taxObligations.filter(t => !t.trashedAt && t.status === 'pending' && safeDateMatch(t.dueDate, dateStr));
                            const dateHolidays = holidays.filter(h => safeDateMatch(h.date, dateStr));

                            const dateGoogleEvents = googleEvents.filter(g => safeDateMatch(g.date, dateStr));

                            const isToday = new Date().toDateString() === dateStr;

                            return (
                                <div key={date.toISOString()} className={`border-r border-b border-border/50 p-2 flex flex-col gap-1 overflow-hidden hover:bg-accent/5 transition-colors ${isToday ? 'bg-primary/5' : ''}`}>
                                    <div className="flex justify-between items-center mb-2 px-1">
                                        <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground'}`}>
                                            {date.getDate()}
                                        </span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 px-1">
                                        {/* Render Holidays */}
                                        {dateHolidays.map((holiday, i) => (
                                            <div key={`h-${i}`} className="text-xs truncate px-2 py-1 rounded bg-green-500/10 text-green-600 font-semibold border border-green-500/20" title={holiday.name}>
                                                🎉 {holiday.name}
                                            </div>
                                        ))}

                                        {/* Render Taxes */}
                                        {dateTaxes.map(tax => (
                                            <div key={`tax-${tax.id}`} className="flex items-center gap-1 text-[11px] truncate px-2 py-1.5 rounded-md bg-red-500/10 text-red-600 font-semibold border border-red-500/20 shadow-sm" title={`Vencimento Guia: ${tax.name}`}>
                                                <PiggyBank className="w-3 h-3 shrink-0" /> {tax.name}
                                            </div>
                                        ))}

                                        {/* Render Documents */}
                                        {dateDocs.map(doc => (
                                            <div key={`doc-${doc.id}`} className="flex items-center gap-1 text-[11px] truncate px-2 py-1.5 rounded-md bg-yellow-500/10 text-yellow-600 font-semibold border border-yellow-500/20 shadow-sm" title={`Doc Expirando: ${doc.title}`}>
                                                <FileText className="w-3 h-3 shrink-0" /> {doc.title}
                                            </div>
                                        ))}

                                        {/* Render Budgets */}
                                        {dateBudgets.map(bud => (
                                            <div key={`bud-${bud.id}`} className="flex items-center gap-1 text-[11px] truncate px-2 py-1.5 rounded-md bg-blue-500/10 text-blue-600 font-semibold border border-blue-500/20 shadow-sm" title={`Proposta Pendente: ${bud.title}`}>
                                                <Calculator className="w-3 h-3 shrink-0" /> {bud.title}
                                            </div>
                                        ))}

                                        {/* Render Kanban Cards */}
                                        {dateCards.map(card => {
                                            const cardLabels = labels.filter(l => card.labels.includes(l.id));
                                            const primaryColor = cardLabels.length > 0 ? cardLabels[0].color : '#3b82f6';
                                            return (
                                                <div
                                                    key={card.id}
                                                    onClick={() => setSelectedCardId(card.id)}
                                                    className="text-[11px] truncate px-2 py-1.5 rounded-md cursor-pointer transition-all hover:opacity-80 text-white font-medium shadow-sm hover:translate-y-[-1px]"
                                                    style={{ backgroundColor: primaryColor }}
                                                    title={card.title}
                                                >
                                                    {card.title}
                                                </div>
                                            );
                                        })}

                                        {/* Render Google Events */}
                                        {dateGoogleEvents.map(g => (
                                            <a key={`g-${g.id}`} href={g.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] truncate px-2 py-1.5 rounded-md bg-blue-600/10 text-blue-600 font-semibold border border-blue-600/20 shadow-sm hover:opacity-80 transition-all font-mono hover:underline" title={`Google Agenda: ${g.title}`}>
                                                <span className="w-3 h-3 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[8px] shrink-0">G</span> {g.title}
                                            </a>
                                        ))}
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
                    <h2 className="font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Painel de Eventos</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {/* Google Sync Info */}
                    <div className="bg-blue-600/5 p-4 rounded-xl border border-blue-600/20">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-700 mb-2">
                            <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">G</span>
                            Google Agenda
                        </h4>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-blue-600/80">
                                {googleEvents.length > 0 
                                    ? `✓ ${googleEvents.length} eventos carregados.` 
                                    : 'Nenhum evento detectado.'}
                            </p>
                            <p className="text-[10px] text-blue-500/60 leading-tight">
                                Sincronizado conforme credenciais do administrador JJ Corporation.
                            </p>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            Próximos 7 Dias
                        </h4>
                        <div className="space-y-3">
                            {allUpcomingEvents.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento próximo do sistema.</p>
                            )}
                            {allUpcomingEvents.map(event => {
                                let Icon = Clock;
                                let colorClass = "text-primary border-primary/20 bg-primary/5";
                                if (event.type === 'orcamento') { Icon = Calculator; colorClass = "text-blue-500 border-blue-500/20 bg-blue-500/5"; }
                                if (event.type === 'documento') { Icon = FileText; colorClass = "text-yellow-600 border-yellow-500/20 bg-yellow-500/5"; }
                                if (event.type === 'contabil') { Icon = PiggyBank; colorClass = "text-red-500 border-red-500/20 bg-red-500/5"; }
                                if (event.type === 'google') { Icon = CalendarIcon; colorClass = "text-blue-600 border-blue-600/30 bg-blue-600/5"; }

                                return (
                                    <div key={`upcoming-${event.type}-${event.id}`}
                                        onClick={() => event.type === 'tarefa' && setSelectedCardId(event.id)}
                                        className={`p-3 rounded-lg border shadow-sm transition-all hover:shadow-md ${colorClass} ${event.type === 'tarefa' ? 'cursor-pointer hover:border-primary/50' : ''}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon className="w-4 h-4 shrink-0" />
                                            <p className="font-semibold text-sm line-clamp-2 text-foreground">{event.title}</p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                            <span className="font-medium">{event.date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {selectedCardId && (
                <CardDetailPanel cardId={selectedCardId} onClose={() => setSelectedCardId(null)} />
            )}
        </div>
    );
}
