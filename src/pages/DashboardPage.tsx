import { useKanbanStore } from '@/store/kanban-store';
import { useAccountingStore } from '@/store/accounting-store';
import { useDocumentStore } from '@/store/document-store';
import { useAuthStore } from '@/store/auth-store';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, TrendingUp, FolderOpen, Filter, Tag, Star, Building2, Truck, Briefcase, BellRing, CalendarDays, FileText, PiggyBank, Calculator, AlertCircle, Info, Calendar as CalendarIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import api from '@/lib/api';
import { fixDateToBRT } from '@/lib/utils';

const Dashboard = () => {
  const { currentUser, hasScreenAccess } = useAuthStore();
  const isAdmin = currentUser?.role === 'ADMIN';

  const canKunbun = hasScreenAccess('KUNBUN');
  const canBudgets = hasScreenAccess('BUDGETS');
  const canDocs = hasScreenAccess('DOCUMENTATION');
  const canAccounting = hasScreenAccess('ACCOUNTING');

  const [googleEvents, setGoogleEvents] = useState<any[]>([]);

  useEffect(() => {
    const loadGoogleEvents = async () => {
      try {
        const res = await api.get('/calendar/events');
        if (res.data.success && res.data.events) {
          setGoogleEvents(res.data.events);
        }
      } catch (err) {
        console.error("Silent Google Events Load Error on Dashboard:", err);
      }
    };
    loadGoogleEvents();
  }, []);

  const folders = useKanbanStore(state => state.folders);
  const boards = useKanbanStore(state => state.boards);
  const lists = useKanbanStore(state => state.lists);
  const cards = useKanbanStore(state => state.cards);
  const labels = useKanbanStore(state => state.labels);
  const companies = useKanbanStore(state => state.companies);
  const budgets = useKanbanStore(state => state.budgets);
  const mainCompanies = useKanbanStore(state => state.mainCompanies);

  const documents = useDocumentStore(state => state.documents);

  const entries = useAccountingStore(state => state.entries);
  const taxObligations = useAccountingStore(state => state.taxObligations);

  // Filters
  const [filterBoard, setFilterBoard] = useState<string>('all');
  const [filterLabel, setFilterLabel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const activeFolders = folders.filter(f => !f.archived && !f.trashed);
  const activeBoards = boards.filter(b => !b.archived && !b.trashed);
  const activeLists = lists.filter(l => !l.archived && !l.trashed);
  const activeCards = cards.filter(c => !c.archived && !c.trashed && c.assignee === currentUser?.id);

  const filteredCards = useMemo(() => {
    let result = activeCards;
    if (filterBoard !== 'all') {
      const boardLists = activeLists.filter(l => l.boardId === filterBoard).map(l => l.id);
      result = result.filter(c => boardLists.includes(c.listId));
    }
    if (filterLabel !== 'all') {
      result = result.filter(c => c.labels.includes(filterLabel));
    }
    if (filterStatus === 'completed') result = result.filter(c => c.completed);
    if (filterStatus === 'pending') result = result.filter(c => !c.completed);
    if (filterStatus === 'overdue') result = result.filter(c => c.dueDate && new Date(c.dueDate) < new Date() && !c.completed);
    return result;
  }, [activeCards, activeLists, filterBoard, filterLabel, filterStatus]);

  const totalCards = filteredCards.length;
  const completedCards = filteredCards.filter(c => c.completed).length;
  const overdueCards = filteredCards.filter(c => c.dueDate && new Date(c.dueDate) < new Date() && !c.completed).length;
  const totalTime = filteredCards.reduce((acc, c) => acc + c.timeEntries.reduce((t, e) => t + e.duration, 0), 0);
  const avgTimeMinutes = totalCards > 0 ? Math.round(totalTime / totalCards / 60) : 0;

  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const weekData = days.map((d, i) => ({
    day: d,
    criadas: Math.max(0, Math.floor(activeCards.length / 7) + (i % 3)),
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
      const list = activeLists.find(l => l.id === card.listId);
      if (!list) return;
      const boardId = list.boardId;
      if (!map.has(boardId)) map.set(boardId, []);
      map.get(boardId)!.push(card);
    });
    return map;
  }, [filteredCards, activeLists]);

  const stats = [
    { label: 'Minhas Tarefas', value: totalCards, icon: BarChart3, color: 'text-primary' },
    { label: 'Concluídas', value: completedCards, icon: CheckCircle2, color: 'text-label-green' },
    { label: 'Atrasadas', value: overdueCards, icon: AlertTriangle, color: 'text-label-red' },
    { label: 'Tempo Médio', value: `${avgTimeMinutes}min`, icon: Clock, color: 'text-accent' },
  ];

  // System-wide alerts calculations
  const defaultCompany = mainCompanies.find(c => c.isDefault);
  const pendingBudgets = budgets.filter(b => !b.trashed && b.status === 'Aguardando').length;
  const expiringDocs = documents.filter(d => !d.trashed && d.status === 'expiring').length;
  const expiredDocs = documents.filter(d => !d.trashed && d.status === 'expired').length;
  const overdueTaxes = taxObligations.filter(t => !t.trashedAt && t.status === 'pending' && new Date(t.dueDate) < new Date()).length;

  // Aggregate all upcoming events (next 15 days)
  const allUpcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureLimit = new Date();
    futureLimit.setDate(today.getDate() + 10);
    futureLimit.setHours(23, 59, 59, 999);

    const fixDate = (d: any) => {
      const date = fixDateToBRT(d);
      return date || new Date(0);
    };

    const events: { id: string; title: string; date: Date; type: string; color: string; icon: React.ElementType; url?: string }[] = [];

    // 1. Kanban Cards
    if (canKunbun) {
      upcomingCards.forEach(c => {
        if (c.dueDate) {
          const list = activeLists.find(l => l.id === c.listId);
          const cDate = fixDate(c.dueDate);
          const isOverdue = cDate < today;
          // Only add if date is valid (not 1970)
          if (cDate.getTime() > 0) {
            events.push({ 
              id: c.id, 
              title: isOverdue ? `[ATRASADA] ${c.title}` : `Tarefa: ${c.title}`, 
              date: cDate, 
              type: 'tarefa', 
              color: isOverdue ? 'text-red-500 font-bold bg-red-500/10 px-1 rounded animate-pulse' : 'text-primary', 
              icon: isOverdue ? AlertCircle : Clock, 
              url: list?.boardId ? `/board/${list.boardId}` : '' 
            });
          }
        }
      });
    }

    // 2. Budgets block removed (per user request to only sync/show expiration dates)

    // 3. Documents
    if (canDocs) {
      documents.filter(d => d.expirationDate && !d.trashed && fixDate(d.expirationDate) <= futureLimit).forEach(d => {
        const dDate = fixDate(d.expirationDate);
        const isOverdue = dDate < today;
        if (dDate.getTime() > 0) {
          events.push({ 
            id: d.id, 
            title: isOverdue ? `[VENCIDO] Doc: ${d.title}` : `Doc Expirando: ${d.title}`, 
            date: dDate, 
            type: 'documento', 
            color: isOverdue ? 'text-red-500 font-bold bg-red-500/10 px-1 rounded animate-pulse' : 'text-yellow-500', 
            icon: isOverdue ? AlertCircle : FileText, 
            url: '/documentacao' 
          });
        }
      });
    }

    // 4. Accounting (Tax Obligations)
    if (canAccounting) {
      taxObligations.filter(t => !t.trashedAt && t.status === 'pending' && fixDate(t.dueDate) <= futureLimit).forEach(t => {
        const tDate = fixDate(t.dueDate);
        const isOverdue = tDate < today;
        if (tDate.getTime() > 0) {
          events.push({ 
            id: t.id, 
            title: isOverdue ? `[VENCIDA] Guia: ${t.name}` : `Imposto a Pagar: ${t.name}`, 
            date: tDate, 
            type: 'contabil', 
            color: isOverdue ? 'text-red-500 font-bold bg-red-500/10 px-1 rounded animate-pulse' : 'text-red-500', 
            icon: isOverdue ? AlertCircle : PiggyBank, 
            url: '/contabil' 
          });
        }
      });
    }

    // 5. Google Calendar & Custom Events
    googleEvents.filter(g => fixDate(g.date) >= today && fixDate(g.date) <= futureLimit).forEach(g => {
      if (g.title && !g.title.startsWith('[Polaryon]')) {
        const gDate = fixDate(g.date);
        if (gDate.getTime() > 0) {
          events.push({ id: g.id, title: g.title, date: gDate, type: 'google', color: 'text-purple-500', icon: CalendarIcon });
        }
      }
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [upcomingCards, budgets, documents, taxObligations, canKunbun, canBudgets, canDocs, canAccounting, googleEvents]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Meu Espaço</h1>
        <p className="text-muted-foreground text-sm mb-4">Bem-vindo(a), {currentUser?.name?.split(' ')[0] || 'Usuário'}. Aqui está o resumo das suas atividades.</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 p-3 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Filtros:</span>
          </div>
          <select value={filterBoard} onChange={e => setFilterBoard(e.target.value)}
            className="bg-secondary rounded px-2 py-1 text-xs outline-none border border-border">
            <option value="all">Todos os Boards</option>
            {activeBoards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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

        {/* System-Wide Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Main Company Info */}
          {isAdmin && (
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Building2 className="h-4 w-4" /> Administradora Padrão
              </div>
              <p className="text-sm font-bold truncate">{defaultCompany?.nomeFantasia || defaultCompany?.razaoSocial || 'Nenhuma definida'}</p>
              <Link to="/company" className="text-[10px] text-primary hover:underline mt-auto">Gerenciar empresas</Link>
            </div>
          )}

          {/* Budgets Alert */}
          {canBudgets && (
            <div className={`rounded-lg p-4 border flex flex-col gap-2 ${pendingBudgets > 0 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-card border-border'}`}>
              <div className={`flex items-center gap-2 font-semibold text-sm ${pendingBudgets > 0 ? 'text-blue-500' : 'text-muted-foreground'}`}>
                <Calculator className="h-4 w-4" /> Orçamentos
              </div>
              <p className="text-sm font-bold">{pendingBudgets} pendentes/em rascunho</p>
              <Link to="/budgets" className="text-[10px] text-muted-foreground hover:underline mt-auto">Ver orçamentos</Link>
            </div>
          )}

          {/* Documents Alert */}
          {canDocs && (
            <div className={`rounded-lg p-4 border flex flex-col gap-2 ${expiredDocs > 0 ? 'bg-destructive/10 border-destructive/20' : expiringDocs > 0 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-card border-border'}`}>
              <div className={`flex items-center gap-2 font-semibold text-sm ${expiredDocs > 0 ? 'text-destructive' : expiringDocs > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                <FileText className="h-4 w-4" /> Documentação
              </div>
              <p className="text-sm font-bold">
                {expiredDocs > 0 ? `${expiredDocs} expirados` : expiringDocs > 0 ? `${expiringDocs} expirando em breve` : 'Tudo em dia'}
              </p>
              <Link to="/documentacao" className="text-[10px] text-muted-foreground hover:underline mt-auto">Acessar acervo</Link>
            </div>
          )}

          {/* Tax/Accounting Alert */}
          {canAccounting && (
            <div className={`rounded-lg p-4 border flex flex-col gap-2 ${overdueTaxes > 0 ? 'bg-destructive/10 border-destructive/20' : 'bg-card border-border'}`}>
              <div className={`flex items-center gap-2 font-semibold text-sm ${overdueTaxes > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                <PiggyBank className="h-4 w-4" /> Contábil
              </div>
              <p className="text-sm font-bold">
                {overdueTaxes > 0 ? `${overdueTaxes} guias vencidas` : 'Impostos em dia'}
              </p>
              <Link to="/contabil" className="text-[10px] text-muted-foreground hover:underline mt-auto">Painel Financeiro</Link>
            </div>
          )}
        </div>

        {canKunbun && (
          <>
            {/* Kanban Stats */}
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Métricas de Tarefas
            </h2>
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

            {/* Favorite Boards */}
            {activeBoards.some(b => b.isFavorite) && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Star className="h-4 w-4 bg-yellow-400 text-white rounded-full p-0.5" fill="currentColor" />
                  Boards Favoritos
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {activeBoards.filter(b => b.isFavorite).map((board, i) => (
                    <motion.div key={board.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="relative group">
                      <Link to={`/board/${board.id}`}
                        className="block rounded-lg h-24 p-4 relative overflow-hidden transition-transform hover:scale-[1.02] bg-cover bg-center border border-border shadow-sm"
                        style={{ backgroundImage: board.backgroundImage ? `url(${board.backgroundImage})` : 'none', backgroundColor: board.backgroundColor }}>
                        {board.backgroundImage && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        )}
                        <div className="relative z-10 flex flex-col h-full">
                          <span className="font-bold text-sm text-white drop-shadow-md line-clamp-2">
                            {board.name}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}


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

              {/* Global Upcoming tasks */}
              <div className="bg-card rounded-lg border border-border p-4 flex flex-col h-full min-h-[400px]">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 shrink-0">
                  <CalendarDays className="h-4 w-4 text-accent" />
                  Próximas Datas Importantes
                </h2>
                <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
                  {allUpcomingEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-8 text-center flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-muted-foreground/30" />
                      Nenhum evento global previsto para os próximos 15 dias!
                    </p>
                  ) : (
                    allUpcomingEvents.map(event => {
                      const Wrapper = event.url ? Link : 'div';
                      return (
                        <Wrapper key={`${event.type}-${event.id}`} to={event.url as any} className={`flex items-center gap-2 p-2 rounded text-xs bg-secondary/50 border border-border/50 hover:bg-secondary transition-colors ${event.url ? 'cursor-pointer' : ''}`}>
                          <event.icon className={`h-3.5 w-3.5 shrink-0 ${event.color}`} />
                          <div className="flex-1 truncate font-medium" title={event.title}>{event.title}</div>
                          <span className={`shrink-0 font-semibold text-muted-foreground`}>
                            {event.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        </Wrapper>
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
                  const board = activeBoards.find(b => b.id === boardId);
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
                {activeFolders.map(folder => {
                  const folderBoards = activeBoards.filter(b => b.folderId === folder.id);
                  const folderCards = activeCards.filter(c => {
                    const list = activeLists.find(l => l.id === c.listId);
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
                {activeFolders.length === 0 && (
                  <p className="text-xs text-muted-foreground col-span-full text-center py-8">
                    Nenhuma pasta ativa
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </motion.div >
    </div >
  );
};

export default Dashboard;
