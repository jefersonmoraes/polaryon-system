import { useKanbanStore } from '@/store/kanban-store';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, TrendingUp, FolderOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { folders, boards, lists, cards } = useKanbanStore();

  const totalCards = cards.length;
  const completedCards = cards.filter(c => c.completed).length;
  const overdueCards = cards.filter(c => c.dueDate && new Date(c.dueDate) < new Date() && !c.completed).length;
  const totalTime = cards.reduce((acc, c) => acc + c.timeEntries.reduce((t, e) => t + e.duration, 0), 0);
  const avgTimeMinutes = totalCards > 0 ? Math.round(totalTime / totalCards / 60) : 0;

  // Weekly data (mock based on card creation dates)
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const weekData = days.map((d, i) => ({
    day: d,
    criadas: Math.max(0, Math.floor(cards.length / 7) + (i % 3)),
    concluídas: Math.max(0, Math.floor(completedCards / 7) + ((i + 1) % 3)),
  }));

  const upcomingCards = cards
    .filter(c => c.dueDate && !c.completed)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5);

  const stats = [
    { label: 'Total de Tarefas', value: totalCards, icon: BarChart3, color: 'text-primary' },
    { label: 'Concluídas', value: completedCards, icon: CheckCircle2, color: 'text-label-green' },
    { label: 'Atrasadas', value: overdueCards, icon: AlertTriangle, color: 'text-label-red' },
    { label: 'Tempo Médio', value: `${avgTimeMinutes}min`, icon: Clock, color: 'text-accent' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-lg p-4 border border-border"
            >
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

        <div className="grid lg:grid-cols-3 gap-6">
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
                upcomingCards.map(card => (
                  <div key={card.id} className="flex items-center gap-2 p-2 rounded bg-secondary/50 text-xs">
                    <div className="flex-1 truncate font-medium">{card.title}</div>
                    <span className="text-muted-foreground shrink-0">
                      {new Date(card.dueDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Folders */}
        <div className="mt-8">
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
                <Link
                  key={folder.id}
                  to={`/folder/${folder.id}`}
                  className="bg-card rounded-lg border border-border p-4 hover:border-primary/50 transition-colors group"
                >
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
