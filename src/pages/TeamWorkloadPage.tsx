import { useKanbanStore } from '@/store/kanban-store';
import { useAuthStore } from '@/store/auth-store';
import { useAccountingStore } from '@/store/accounting-store';
import { useDocumentStore } from '@/store/document-store';
import { Users, CheckCircle2, Clock, AlertCircle, FileText, PiggyBank, Calculator, Target } from 'lucide-react';
import CardDetailPanel from '@/components/board/CardDetailPanel';
import { useState, useMemo } from 'react';
import { Card } from '@/types/kanban';

export default function TeamWorkloadPage() {
    const members = useKanbanStore(state => (state.members || []).filter(m => 
        !m.email?.toLowerCase().includes('jjcorporation') && 
        !m.name?.toLowerCase().includes('jjcorporation')
    ));
    const cards = useKanbanStore(state => state.cards);
    const boards = useKanbanStore(state => state.boards);
    const lists = useKanbanStore(state => state.lists);
    const labels = useKanbanStore(state => state.labels);
    const budgets = useKanbanStore(state => state.budgets);
    const documents = useDocumentStore(state => state.documents);
    const entries = useAccountingStore(state => state.entries);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week');

    // Filter only active cards
    const activeCards = cards.filter(c => !c.archived && !c.trashed);

    const getCardPriority = (card: Card) => {
        const cardLabels = labels.filter(l => card.labels.includes(l.id));
        if (cardLabels.some(l => l.name.toLowerCase().includes('urgent') || l.color === '#ef4444')) return 1;
        if (cardLabels.some(l => l.name.toLowerCase().includes('important') || l.color === '#f97316')) return 2;
        if (cardLabels.some(l => l.color === '#eab308')) return 3;
        if (cardLabels.length > 0) return 4;
        return 5;
    };

    const getMemberStats = (memberId: string) => {
        const now = new Date();
        const startOfPeriod = new Date();
        if (period === 'week') {
            const day = startOfPeriod.getDay();
            const diff = startOfPeriod.getDate() - day + (day === 0 ? -6 : 1); // get Monday
            startOfPeriod.setDate(diff);
            startOfPeriod.setHours(0, 0, 0, 0);
        } else if (period === 'month') {
            startOfPeriod.setDate(1);
            startOfPeriod.setHours(0, 0, 0, 0);
        } else if (period === 'year') {
            startOfPeriod.setMonth(0, 1);
            startOfPeriod.setHours(0, 0, 0, 0);
        }

        const memberCards = activeCards.filter(c => {
            if (c.assignee !== memberId) return false;

            // Check if card belongs to the period based on its dates or completed status
            // Time entries within the period could also be checked, but we'll use due/start/completion dates
            let cardDate = new Date(c.createdAt || Date.now());
            if (c.dueDate) cardDate = new Date(c.dueDate);
            else if (c.startDate) cardDate = new Date(c.startDate);

            return cardDate >= startOfPeriod;
        });

        const completed = memberCards.filter(c => c.completed).length;
        const pending = memberCards.length - completed;
        const overdue = memberCards.filter(c => !c.completed && c.dueDate && new Date(c.dueDate) < new Date()).length;
        const completionRate = memberCards.length > 0 ? Math.round((completed / memberCards.length) * 100) : 0;

        return {
            total: memberCards.length,
            completed,
            pending,
            overdue,
            completionRate,
            cards: memberCards.sort((a, b) => getCardPriority(a) - getCardPriority(b))
        };
    };

    const unassignedCards = activeCards.filter(c => !c.assignee && !c.completed && c.listId && lists.some(l => l.id === c.listId));

    // Global System Stats
    const systemStats = useMemo(() => {
        const now = new Date();
        const startOfPeriod = new Date();
        if (period === 'week') {
            const day = startOfPeriod.getDay();
            const diff = startOfPeriod.getDate() - day + (day === 0 ? -6 : 1);
            startOfPeriod.setDate(diff);
            startOfPeriod.setHours(0, 0, 0, 0);
        } else if (period === 'month') {
            startOfPeriod.setDate(1);
            startOfPeriod.setHours(0, 0, 0, 0);
        } else if (period === 'year') {
            startOfPeriod.setMonth(0, 1);
            startOfPeriod.setHours(0, 0, 0, 0);
        }

        const periodBudgets = budgets.filter(b => !b.trashed && new Date(b.createdAt) >= startOfPeriod);
        const periodDocs = documents.filter(d => !d.trashed && new Date(d.createdAt) >= startOfPeriod);
        const periodEntries = entries.filter(e => !e.trashedAt && new Date(e.date) >= startOfPeriod);

        return {
            budgetsCreated: periodBudgets.length,
            budgetsApproved: periodBudgets.filter(b => b.status === 'Aprovado').length,
            docsAdded: periodDocs.length,
            entriesProcessed: periodEntries.length
        };
    }, [budgets, documents, entries, period]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="p-6 border-b border-border bg-card shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">Equipe e Fluxo de Trabalho</h1>
                        <p className="text-sm text-muted-foreground">Métricas de produtividade e cards por membro</p>
                    </div>
                </div>

                <div className="flex items-center bg-secondary rounded-lg p-1">
                    <button onClick={() => setPeriod('week')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${period === 'week' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        Esta Semana
                    </button>
                    <button onClick={() => setPeriod('month')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${period === 'month' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        Este Mês
                    </button>
                    <button onClick={() => setPeriod('year')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${period === 'year' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        Este Ano
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                {/* Global Operating Stats Header */}
                <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                            <Calculator className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Orçamentos</p>
                            <p className="text-xl font-bold">{systemStats.budgetsCreated} <span className="text-[10px] text-muted-foreground font-medium">({systemStats.budgetsApproved} aprovados)</span></p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Documentos</p>
                            <p className="text-xl font-bold">{systemStats.docsAdded} <span className="text-[10px] text-muted-foreground font-medium">atualizados</span></p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
                            <PiggyBank className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Lançamentos</p>
                            <p className="text-xl font-bold">{systemStats.entriesProcessed} <span className="text-[10px] text-muted-foreground font-medium">registrados</span></p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                            <Target className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Eficiência Geral</p>
                            <p className="text-xl font-bold">{members.length > 0 ? Math.round((members.map(m => getMemberStats(m.id).completionRate).reduce((a, b) => a + b, 0)) / members.length) : 0}% <span className="text-[10px] text-muted-foreground font-medium">entregas</span></p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {members.map(member => {
                        const stats = getMemberStats(member.id);
                        return (
                            <div key={member.id} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm flex flex-col max-h-[500px]">
                                <div className="p-4 border-b border-border bg-muted/20">
                                    <div className="flex items-center gap-3 mb-4">
                                        <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-full border-2 border-primary object-cover" />
                                        <div className="overflow-hidden">
                                            <h3 className="font-bold text-foreground truncate">{member.name}</h3>
                                            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        <div className="bg-background rounded p-2 text-center border border-border">
                                            <p className="text-[10px] text-muted-foreground uppercase mb-1 truncate">Total</p>
                                            <p className="font-bold text-sm">{stats.total}</p>
                                        </div>
                                        <div className="bg-background rounded p-2 text-center border border-border">
                                            <p className="text-[10px] text-muted-foreground uppercase mb-1 truncate">Atrasos</p>
                                            <p className="font-bold text-sm text-destructive">{stats.overdue}</p>
                                        </div>
                                        <div className="bg-background rounded p-2 text-center border border-border">
                                            <p className="text-[10px] text-muted-foreground uppercase mb-1 truncate">Prontos</p>
                                            <p className="font-bold text-sm text-label-green">{stats.completed}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                                            <span>Progresso</span>
                                            <span>{stats.completionRate}%</span>
                                        </div>
                                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${stats.completionRate}%` }} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-background/50">
                                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase px-1 mb-2">Tarefas Atribuídas: {stats.cards.length}</h4>
                                    {stats.cards.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa atribuída</p>
                                    ) : (
                                        stats.cards.map(card => {
                                            const list = lists.find(l => l.id === card.listId);
                                            const board = boards.find(b => b.id === list?.boardId);
                                            const cardLabels = labels.filter(l => card.labels.includes(l.id));

                                            return (
                                                <div key={card.id} onClick={() => setSelectedCardId(card.id)} className={`p-2 rounded-lg border shadow-sm cursor-pointer transition-all hover:-translate-y-[1px] ${card.completed ? 'opacity-60 border-label-green/30 bg-label-green/5' : 'border-border bg-card hover:border-primary/50'}`}>
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <span className={`text-xs font-semibold line-clamp-2 ${card.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{card.title}</span>
                                                        {cardLabels.length > 0 && <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: cardLabels[0].color }} title={cardLabels[0].name} />}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                                                        <span className="truncate max-w-[120px] bg-secondary px-1.5 py-0.5 rounded text-foreground font-medium">{board?.name}</span>
                                                        {card.dueDate && (
                                                            <span className={`flex items-center gap-1 ml-auto font-medium ${card.completed ? '' : (new Date(card.dueDate) < new Date() ? 'text-destructive' : 'text-primary')}`}>
                                                                <Clock className="w-3 h-3" /> {new Date(card.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Unassigned Cards Panel */}
                    <div className="bg-secondary/30 rounded-xl border border-border border-dashed overflow-hidden flex flex-col max-h-[500px]">
                        <div className="p-4 border-b border-border/50 bg-muted/10">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full border-2 border-border border-dashed flex items-center justify-center text-muted-foreground bg-background">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">Sem Responsável</h3>
                                    <p className="text-xs text-muted-foreground">Tarefas aguardando atribuição</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50 w-max mt-4">
                                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Total Pendentes</span>
                                <span className="text-sm font-bold">{unassignedCards.length}</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {unassignedCards.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-8">Todas as tarefas ativas foram atribuídas a alguém!</p>
                            ) : (
                                unassignedCards.map(card => {
                                    const list = lists.find(l => l.id === card.listId);
                                    const board = boards.find(b => b.id === list?.boardId);
                                    return (
                                        <div key={`u-${card.id}`} onClick={() => setSelectedCardId(card.id)} className="p-2 rounded-lg border border-border bg-card shadow-sm cursor-pointer hover:border-primary/50 transition-all flex flex-col gap-1 hover:-translate-y-[1px]">
                                            <p className="text-xs font-semibold line-clamp-2">{card.title}</p>
                                            <span className="text-[10px] text-muted-foreground w-max font-medium bg-secondary px-1.5 py-0.5 rounded truncate inline-block max-w-full">{board?.name}</span>
                                        </div>
                                    );
                                })
                            )}
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
