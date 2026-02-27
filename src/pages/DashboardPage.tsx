import { useKanbanStore } from '@/store/kanban-store';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, TrendingUp, FolderOpen, Filter, Tag } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';

const Dashboard = () => {
  const { folders, boards, lists, cards, labels } = useKanbanStore();

  // Filters
  const [filterBoard, setFilterBoard] = useState<string>('all');
  const [filterLabel, setFilterLabel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredCards = useMemo(() => {
    let result = cards;
    if (filterBoard !== 'all') {
      const boardLists = lists.filter(l => l.boardId === filterBoard).map(l => l.id);
      result = result.filter(c => boardLists.includes(c.listId));
    }
    if (filterLabel !== 'all') {
      result = result.filter(c => c.labels.includes(filterLabel));
    }
    if (filterStatus === 'completed') result = result.filter(c => c.completed);
    if (filterStatus === 'pending') result = result.filter(c => !c.completed);
    if (filterStatus === 'overdue') result = result.filter(c => c.dueDate && new Date(c.dueDate) < new Date() && !c.completed);
    return result;
  }, [cards, lists, filterBoard, filterLabel, filterStatus]);

  const totalCards = filteredCards.length;
  const completedCards = filteredCards.filter(c => c.completed).length;
  const overdueCards = filteredCards.filter(c => c.dueDate && new Date(c.dueDate) < new Date() && !c.completed).length;
  const totalTime = filteredCards.reduce((acc, c) => acc + c.timeEntries.reduce((t, e) => t + e.duration, 0), 0);
  const avgTimeMinutes = totalCards > 0 ? Math.round(totalTime / totalCards / 60) : 0;

  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const weekData = days.map((d, i) => ({
    day: d,
    criadas: Math.max(0, Math.floor(cards.length / 7) + (i % 3)),
    concluídas: Math.max(0, Math.floor(completedCards / 7) + ((i + 1) % 3)),
  }));

  const upcomingCards = filteredCards
    .filter(c => c.dueDate && !c.completed)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 8);

  // Cards grouped by board
  const cardsByBoard = useMemo(() => {
    const map = new Map<string, typeof cards>();
    filteredCards.forEach(card => {
      const list = lists.find(l => l.id === card.listId);
      if (!list) return;
      const boardId = list.boardId;
      if (!map.has(boardId)) map.set(boardId, []);
      map.get(boardId)!.push(card);
    });
    return map;
  }, [filteredCards, lists]);

  const stats = [
    { label: 'Total de Tarefas', value: totalCards, icon: BarChart3, color: 'text-primary' },
    { label: 'Concluídas', value: completedCards, icon: CheckCircle2, color: 'text-label-green' },
    { label: 'Atrasadas', value: overdueCards, icon: AlertTriangle, color: 'text-label-red' },
    { label: 'Tempo Médio', value: `${avgTimeMinutes}min`, icon: Clock, color: 'text-accent' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 p-3 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Filtros:</span>
          </div>
          <select value={filterBoard} onChange={e => setFilterBoard(e.target.value)}
            className="bg-secondary rounded px-2 py-1 text-xs outline-none border border-border">
            <option value="all">Todos os Boards</option>
            {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)}
            className="bg-secondary rounded px-2 py-1 text-xs outline-none border border-border">
            <option value="all">Todas as Etiquetas</option>
            {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-secondary rounded px-2 py-1 text-xs outline-none border border-border">
            <option value="all">Todos os Status</option>
            <option value="pending">Pendentes</option>
            <option value="completed">Concluídas</option>
            <option value="overdue">Atrasadas</option>
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-3">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold">{s.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Chart */}
          <div className="lg:col-span-2 bg-card rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Produtividade Semanal
            </h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekData}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="criadas" fill="hsl(205, 95%, 33%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="concluídas" fill="hsl(145, 63%, 42%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming tasks */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Próximas Entregas
            </h2>
            <div className="space-y-2">
              {upcomingCards.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma tarefa com data de entrega</p>
              ) : (
                upcomingCards.map(card => {
                  const isOverdue = new Date(card.dueDate!) < new Date();
                  return (
                    <div key={card.id} className={`flex items-center gap-2 p-2 rounded text-xs ${isOverdue ? 'bg-label-red/10' : 'bg-secondary/50'}`}>
                      <div className="flex-1 truncate font-medium">{card.title}</div>
                      <span className={`shrink-0 ${isOverdue ? 'text-label-red font-semibold' : 'text-muted-foreground'}`}>
                        {new Date(card.dueDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Tasks by Board */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Visão por Board
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from(cardsByBoard.entries()).map(([boardId, boardCards]) => {
              const board = boards.find(b => b.id === boardId);
              if (!board) return null;
              const pending = boardCards.filter(c => !c.completed).length;
              const done = boardCards.filter(c => c.completed).length;
              const overdue = boardCards.filter(c => c.dueDate && new Date(c.dueDate) < new Date() && !c.completed).length;
              return (
                <Link key={boardId} to={`/board/${boardId}`}
                  className="bg-card rounded-lg border border-border p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-sm" style={{ background: board.backgroundColor }} />
                    <span className="font-medium text-sm">{board.name}</span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-muted-foreground">Pendentes: <b className="text-foreground">{pending}</b></span>
                    <span className="text-muted-foreground">Feitas: <b className="text-label-green">{done}</b></span>
                    {overdue > 0 && <span className="text-label-red font-semibold">Atrasadas: {overdue}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Folders */}
        <div>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            Suas Pastas
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {folders.map(folder => {
              const folderBoards = boards.filter(b => b.folderId === folder.id);
              const folderCards = cards.filter(c => {
                const list = lists.find(l => l.id === c.listId);
                return list && folderBoards.some(b => b.id === list.boardId);
              });
              return (
                <Link key={folder.id} to={`/folder/${folder.id}`}
                  className="bg-card rounded-lg border border-border p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-sm" style={{ background: folder.color }} />
                    <span className="font-medium text-sm truncate">{folder.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {folderBoards.length} boards · {folderCards.length} tarefas
                  </div>
                </Link>
              );
            })}
            {folders.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-full text-center py-8">
                Use a barra lateral para criar sua primeira pasta 👈
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
