import { useState } from 'react';
import { CompanyDocument } from '@/store/document-store';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    parseISO,
    isToday,
    startOfWeek,
    endOfWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, FileText, AlertTriangle, CheckCircle, Calendar as CalendarIcon } from 'lucide-react';

interface DocumentCalendarViewProps {
    documents: CompanyDocument[];
    onEditDocument: (doc: CompanyDocument) => void;
}

const DocumentCalendarView = ({ documents, onEditDocument }: DocumentCalendarViewProps) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const startDate = startOfWeek(startOfMonth(currentDate));
    const endDate = endOfWeek(endOfMonth(currentDate));

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const getDocumentsForDate = (date: Date) => {
        return documents.filter(doc => {
            const docDate = parseISO(doc.expirationDate);
            return isSameDay(docDate, date) && !doc.trashed;
        });
    };

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'valid': return <CheckCircle className="h-3 w-3 text-emerald-500" />;
            case 'expiring': return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
            case 'expired': return <AlertTriangle className="h-3 w-3 text-red-500" />;
            default: return <FileText className="h-3 w-3" />;
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'valid': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400';
            case 'expiring': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400';
            case 'expired': return 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400';
            default: return 'bg-muted border-border text-foreground';
        }
    };

    return (
        <div className="bg-card rounded-xl border border-border/20 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/20 bg-muted/20 shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                    </h2>
                    <button
                        onClick={goToToday}
                        className="px-3 py-1 text-xs font-medium bg-background border border-border rounded-full hover:bg-muted transition-colors"
                    >
                        Hoje
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={prevMonth}
                        className="p-1.5 hover:bg-muted rounded transition-colors"
                        title="Mês Anterior"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-1.5 hover:bg-muted rounded transition-colors"
                        title="Próximo Mês"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 border-b border-border/20 bg-muted/10 shrink-0">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6 auto-rows-[1fr]">
                {calendarDays.map((day, idx) => {
                    const docsForDay = getDocumentsForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isTodayDate = isToday(day);

                    return (
                        <div
                            key={day.toISOString()}
                            className={`min-h-[100px] border-b border-r border-border/10 p-2 flex flex-col transition-colors
                                ${!isCurrentMonth ? 'bg-muted/5 opacity-50' : 'bg-background hover:bg-muted/5'}
                                ${idx % 7 === 0 ? 'border-l-0' : ''}
                                ${idx >= calendarDays.length - 7 ? 'border-b-0' : ''}
                            `}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                                    ${isTodayDate ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                                `}>
                                    {format(day, 'd')}
                                </span>
                                {docsForDay.length > 0 && (
                                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 rounded">
                                        {docsForDay.length}
                                    </span>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                                {docsForDay.map(doc => (
                                    <button
                                        key={doc.id}
                                        onClick={() => onEditDocument(doc)}
                                        className={`w-full text-left p-1.5 rounded border text-[10px] sm:text-xs font-medium cursor-pointer transition-all hover:brightness-95 hover:shadow-sm ${getStatusBg(doc.status)}`}
                                        title={doc.title}
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <div className="shrink-0">
                                                {getStatusIcon(doc.status)}
                                            </div>
                                            <span className="truncate flex-1">{doc.title}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DocumentCalendarView;
