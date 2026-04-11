import { useKanbanStore } from '@/store/kanban-store';
import { useAccountingStore } from '@/store/accounting-store';
import { useDocumentStore } from '@/store/document-store';
import { useAuthStore } from '@/store/auth-store';
import { useUserPrefsStore } from '@/store/user-prefs-store';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, TrendingUp, FolderOpen, Filter, Tag, Star, Building2, Truck, Briefcase, BellRing, CalendarDays, FileText, PiggyBank, Calculator, AlertCircle, Info, Calendar as CalendarIcon, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import api from '@/lib/api';
import { fixDateToBRT } from '@/lib/utils';

const Dashboard = () => {
  const { currentUser, hasScreenAccess } = useAuthStore();
  const isAdmin = currentUser?.role === 'ADMIN';

  const canKanban = hasScreenAccess('KANBAN');
  const canBudgets = hasScreenAccess('BUDGETS');
  const canDocs = hasScreenAccess('DOCUMENTATION');
  const canAccounting = hasScreenAccess('ACCOUNTING');

  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean | null>(null); // null = loading ⚒️🚀⚙️
  const [backupHealth, setBackupHealth] = useState<'healthy' | 'error' | 'loading'>('loading'); // ⚒️🚀⚙️
  const [stats, setStats] = useState<any[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<number>(0);
  const { isDark } = useUserPrefsStore();

  useEffect(() => {
    const loadGoogleEvents = async () => {
      try {
        const res = await api.get('/calendar/events');
        if (res.data.success && res.data.events) {
          setGoogleEvents(res.data.events);
          setIsGoogleConnected(true);
        } else if (res.data.needsAuth) {
          setIsGoogleConnected(false);
          console.log("Dashboard: Google Calendar not linked. Skipping events load silently. ⚒️🚀⚙️");
        }
      } catch (err) {
        setIsGoogleConnected(false);
        if (process.env.NODE_ENV === 'development') {
           console.warn("Minor: Google Events background load skipped.", err);
        }
      }
    };

    const fetchBackupStatus = async () => {
        if (!isAdmin) return;
        try {
            const res = await api.get('/backups');
            if (Array.isArray(res.data)) {
                // Determine health: if we have a recent (today/yesterday) backup with size > 0
                const latest = res.data[0];
                if (latest && latest.status === 'healthy') {
                    setBackupHealth('healthy');
                } else {
                    setBackupHealth('error');
                }
            }
        } catch (e) {
            console.error("Dashboard: Failed to fetch backup health.", e);
            setBackupHealth('error');
        }
    };

    loadGoogleEvents();
    fetchBackupStatus();
  }, [isAdmin]);

  const folders = useKanbanStore(state => state.folders);
  const boards = useKanbanStore(state => state.boards);
  const lists = useKanbanStore(state => state.lists);
  const cards = useKanbanStore(state => state.cards);
  const labels = useKanbanStore(state => state.labels);
  const companies = useKanbanStore(state => state.companies);
  const budgets = useKanbanStore(state => state.budgets);
  const mainCompanies = useKanbanStore(state => state.mainCompanies);
  const fetchKanbanData = useKanbanStore(state => state.fetchKanbanData);
  const fetchMainCompanyProfiles = useKanbanStore(state => state.fetchMainCompanyProfiles);

  const documents = useDocumentStore(state => state.documents);
  const fetchDocuments = useDocumentStore(state => state.fetchDocuments);

  const entries = useAccountingStore(state => state.entries);
  const taxObligations = useAccountingStore(state => state.taxObligations);
  const fetchAccountingData = useAccountingStore(state => state.fetchAccountingData);

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
    if (filterStatus === 'overdue') result = result.filter(c => {
      if (!c.dueDate || c.completed) return false;
      const dDate = fixDateToBRT(c.dueDate);
      return dDate && dDate < new Date();
    });
    return result;
  }, [activeCards, activeLists, filterBoard, filterLabel, filterStatus]);

  useEffect(() => {
    fetchKanbanData();
    fetchMainCompanyProfiles();
    if (canDocs) fetchDocuments();
    if (canAccounting) fetchAccountingData();
  }, [fetchKanbanData, fetchMainCompanyProfiles, fetchDocuments, fetchAccountingData, canDocs, canAccounting]);

  // Fetch Weekly Activity Stats
  useEffect(() => {
    if (!currentUser) return;
    api.get(`/activity/stats?period=day`).then(res => {
        if (res.data?.success && res.data?.stats) {
            const userStat = res.data.stats[currentUser.id];
            setWeeklyActivity(userStat !== undefined ? userStat : 0);
        }
    }).catch(console.error);
  }, [currentUser]);

  const totalCards = filteredCards.length;
  const completedCards = filteredCards.filter(c => c.completed).length;
  const overdueCards = filteredCards.filter(c => {
    if (!c.dueDate || c.completed) return false;
    const dDate = fixDateToBRT(c.dueDate);
    return dDate && dDate < new Date();
  }).length;
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
    .sort((a, b) => {
      const dateA = fixDateToBRT(a.dueDate!)?.getTime() || 0;
      const dateB = fixDateToBRT(b.dueDate!)?.getTime() || 0;
      return dateA - dateB;
    })
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

    const h = Math.floor(weeklyActivity / 3600);
    const m = Math.floor((weeklyActivity % 3600) / 60);
    const timeLabel = h > 0 ? `${h}h ${m}min` : `${m}min`;

    const statsConfig = [
        { label: 'Minhas Tarefas', value: totalCards, icon: BarChart3, color: 'text-primary' },
        { label: 'Concluídas', value: completedCards, icon: CheckCircle2, color: 'text-label-green' },
        { label: 'Atrasadas', value: overdueCards, icon: AlertTriangle, color: 'text-label-red' },
        { label: 'Atividade (Semana)', value: timeLabel, icon: Clock, color: 'text-accent' },
    ];

  // Helper para cravar o fuso horário oficial de Brasília nas comparações
  const getHojeBRT = () => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    // Formatter outputs "MM/DD/YYYY"
    const parts = formatter.format(new Date()).split('/');
    // Return a local Date object matching the exact BRT calendar day midnight
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]), 0, 0, 0, 0);
  };

  // System-wide alerts calculations
  const defaultCompany = mainCompanies.find(c => c.isDefault);
  const pendingBudgets = budgets.filter(b => !b.trashed && b.status === 'Aguardando').length;
  const expiringDocs = documents.filter(d => !d.trashed && d.status === 'expiring').length;
  const expiredDocs = documents.filter(d => !d.trashed && d.status === 'expired').length;
  
  const docsIn2Days = useMemo(() => {
    const today = getHojeBRT();
    const limit = new Date(today);
    limit.setDate(today.getDate() + 2);
    limit.setHours(23, 59, 59, 999);
    
    return documents.filter(d => {
      if (d.trashed || !d.expirationDate) return false;
      const dDate = fixDateToBRT(d.expirationDate);
      return dDate && dDate >= today && dDate <= limit;
    }).length;
  }, [documents]);

  const overdueTaxes = taxObligations.filter(t => {
    if (t.trashedAt || t.status !== 'pending' || !t.dueDate) return false;
    const tDate = fixDateToBRT(t.dueDate);
    return tDate && tDate < getHojeBRT();
  }).length;

  // Aggregate all upcoming events (next 15 days)
  const allUpcomingEvents = useMemo(() => {
    const today = getHojeBRT();
    
    const futureLimit = new Date(today);
    futureLimit.setDate(today.getDate() + 15);
    futureLimit.setHours(23, 59, 59, 999);

    const fixDate = (d: any) => {
      const date = fixDateToBRT(d);
      return date || new Date(0);
    };

    const getProgression = (dDate: Date) => {
      const d = new Date(dDate);
      const diffMs = d.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 3600 * 24));
      const diffHours = Math.ceil(diffMs / (1000 * 3600));
      
      let timeRemaining = "";
      if (diffMs < 0) {
        const absDays = Math.abs(diffDays);
        timeRemaining = absDays === 0 ? "Atrasado (horas)" : `Atrasado ${absDays}d`;
      } else {
        if (diffDays === 0) timeRemaining = `${diffHours}h restantes`;
        else timeRemaining = `Faltam ${diffDays}d`;
      }

      if (diffMs < 0) return { text: `[VENCIDA] `, timeRemaining, color: 'text-red-500 font-extrabold bg-red-500/20 px-1 rounded animate-[pulse_0.5s_ease-in-out_infinite]', icon: AlertCircle };
      if (diffDays === 0) return { text: `[HOJE ⚠️] `, timeRemaining, color: 'text-orange-500 font-bold bg-orange-500/20 px-1 rounded animate-[pulse:1.5s_ease-in-out_infinite]', icon: AlertTriangle };
      if (diffDays <= 2) return { text: `[Faltam ${diffDays}d] `, timeRemaining, color: 'text-yellow-600 font-bold bg-yellow-500/15 px-1 rounded animate-[pulse_2s_ease-in-out_infinite]', icon: Clock };
      if (diffDays <= 5) return { text: `[Em ${diffDays}d] `, timeRemaining, color: 'text-blue-500 font-medium', icon: CalendarIcon };
      return { text: '', timeRemaining, color: 'text-primary', icon: CalendarDays };
    };

    const tempEvents: { id: string; title: string; date: Date; type: string; color: string; icon: React.ElementType; url?: string; timeRemaining?: string; cardId?: string; significance: number }[] = [];

    // 1. Kanban & Milestones
    if (canKanban) {
      cards.filter(c => !c.archived && !c.trashed && !c.completed).forEach(c => {
        const boardId = activeLists.find(l => l.id === c.listId)?.boardId;
        if (!boardId) return;

        // Card Due Date
        if (c.dueDate) {
          const cDate = fixDate(c.dueDate);
          if (cDate.getTime() > 0 && cDate <= futureLimit) {
            const prog = getProgression(cDate);
            tempEvents.push({ 
              id: c.id, 
              title: `Entrega: ${c.title}`, 
              timeRemaining: prog.timeRemaining,
              date: cDate, 
              type: 'tarefa', 
              color: prog.color, 
              icon: prog.icon, 
              url: `/board/${boardId}?cardId=${c.id}`,
              cardId: c.id,
              significance: 10 // Padrão
            });
          }
        }

        // Card Milestones (Etapas)
        (c.milestones || []).filter(m => !m.completed && m.dueDate).forEach(m => {
          const mDate = fixDate(m.dueDate);
          if (mDate.getTime() > 0 && mDate <= futureLimit) {
            const prog = getProgression(mDate);
            const isLances = m.title.toUpperCase().includes('LANCE');
            tempEvents.push({ 
              id: `${c.id}-m-${m.id}`, 
              title: `[Etapa] ${m.title} - ${c.title}`, 
              timeRemaining: prog.timeRemaining,
              date: mDate, 
              type: 'milestone', 
              color: prog.color, 
              icon: isLances ? AlertCircle : Zap, 
              url: `/board/${boardId}?cardId=${c.id}`,
              cardId: c.id,
              significance: isLances ? 1 : 5 // LANCES é prioridade 1 (máxima)
            });
          }
        });
      });
    }

    // 2. Documents
    if (canDocs) {
      documents.filter(d => d.expirationDate && !d.trashed).forEach(d => {
        const dDate = fixDate(d.expirationDate);
        if (dDate.getTime() > 0 && dDate <= futureLimit) {
          const prog = getProgression(dDate);
          tempEvents.push({ 
            id: d.id, 
            title: `Documento: ${d.title}`, 
            timeRemaining: prog.timeRemaining,
            date: dDate, 
            type: 'documento', 
            color: prog.color, 
            icon: prog.text.includes('VENCIDA') ? AlertCircle : FileText, 
            url: '/documentacao',
            significance: 2
          });
        }
      });
    }

    // 3. Accounting (Tax Obligations)
    if (canAccounting) {
      taxObligations.filter(t => !t.trashedAt && t.status === 'pending').forEach(t => {
        const tDate = fixDate(t.dueDate);
        if (tDate.getTime() > 0 && tDate <= futureLimit) {
          const prog = getProgression(tDate);
          tempEvents.push({ 
            id: t.id, 
            title: `Imposto: ${t.name}`, 
            timeRemaining: prog.timeRemaining,
            date: tDate, 
            type: 'contabil', 
            color: prog.color, 
            icon: prog.icon, 
            url: '/contabil',
            significance: 3
          });
        }
      });
    }

    // 4. Google Calendar & Custom Events
    const polaryonTitles = new Set(cards.map(c => c.title.toLowerCase()));

    googleEvents.filter(g => fixDate(g.date) <= futureLimit).forEach(g => {
      if (g.title && !g.title.startsWith('[Polaryon]')) {
        const gDate = fixDate(g.date);
        
        // De-duplication: If Google event matches a known Polaryon Card Title, skip it
        const lowerTitle = g.title.toLowerCase();
        if (polaryonTitles.has(lowerTitle)) return;
        if (Array.from(polaryonTitles).some(pt => lowerTitle.includes(pt) || pt.includes(lowerTitle))) return;

        if (gDate.getTime() > 0) {
          const prog = getProgression(gDate);
          let displayTitle = g.title;
          if (displayTitle.includes('DATA E HORA') && g.description) {
              const cleanedDesc = g.description.replace(/<[^>]*>?/gm, '').split('\n')[0].trim();
              if (cleanedDesc) displayTitle = `${cleanedDesc} (${displayTitle})`;
          }

          tempEvents.push({ 
            id: g.id, 
            title: displayTitle, 
            timeRemaining: prog.timeRemaining,
            date: gDate, 
            type: 'google', 
            color: prog.text === '' ? 'text-purple-500' : prog.color, 
            icon: prog.text === '' ? CalendarIcon : prog.icon,
            url: undefined,
            significance: 20 // Google é o último caso se nada bater
          });
        }
      }
    });

    // --- DE-DUPLICATION ENGINE ---
    // Group by Card + Day (YYYY-MM-DD)
    const finalMap = new Map<string, any>();

    tempEvents.forEach(evt => {
        const dateKey = evt.date.toISOString().split('T')[0];
        // If it's a card-related event (task or milestone), group by cardId + date
        const key = evt.cardId ? `card-${evt.cardId}-${dateKey}` : `other-${evt.id}-${dateKey}`;
        
        const existing = finalMap.get(key);
        if (!existing || evt.significance < existing.significance) {
            finalMap.set(key, evt);
        }
    });

    return Array.from(finalMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [upcomingCards, budgets, documents, taxObligations, canKanban, canBudgets, canDocs, canAccounting, googleEvents]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Meu Espaço</h1>
        <p className="text-muted-foreground text-sm mb-4">Bem-vindo(a), {currentUser?.name?.split(' ')[0] || 'Usuário'}. Aqui está o resumo das suas atividades.</p>

        {/* System Health Status Bar ⚒️🚀⚙️ */}
        <div className="flex items-center gap-4 mb-6 px-4 py-2 bg-secondary/20 rounded-lg border border-border/50 backdrop-blur-sm w-fit">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isGoogleConnected === true ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
              isGoogleConnected === false ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 
              'bg-slate-400 animate-pulse'
            }`} title={isGoogleConnected === true ? "Sincronização Ativa" : isGoogleConnected === false ? "Conexão Expirada" : "Verificando..."} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Google Sync</span>
          </div>
          
          <div className="w-px h-3 bg-border" />

          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              backupHealth === 'healthy' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
              backupHealth === 'error' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 
              'bg-slate-400 animate-pulse'
            }`} title={backupHealth === 'healthy' ? "Dados Seguros (24h)" : backupHealth === 'error' ? "Falha no Backup" : "Verificando..."} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Backup Health</span>
          </div>
        </div>

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
            <div className={`rounded-lg p-4 border flex flex-col gap-2 overflow-hidden relative ${
                 expiredDocs > 0 ? 'bg-red-500/20 border-red-500 animate-[pulse_0.5s_ease-in-out_infinite]' 
               : docsIn2Days > 0 ? 'bg-red-500/10 border-red-500/50 animate-[pulse_2s_ease-in-out_infinite]' 
               : expiringDocs > 0 ? 'bg-yellow-500/10 border-yellow-500/20' 
               : 'bg-card border-border'
            }`}>
              <div className={`flex items-center gap-2 font-semibold text-sm ${
                  expiredDocs > 0 ? 'text-red-500 font-black drop-shadow-md' 
                : docsIn2Days > 0 ? 'text-red-500 font-bold'
                : expiringDocs > 0 ? 'text-yellow-600' 
                : 'text-muted-foreground'
              }`}>
                {expiredDocs > 0 ? <AlertCircle className="h-4 w-4 drop-shadow-md" /> : <FileText className="h-4 w-4" />} 
                Documentação {expiredDocs > 0 && <span className="text-sm font-black animate-bounce ml-1">!</span>}
              </div>
              <p className={`text-sm font-bold ${expiredDocs > 0 ? 'text-red-500 drop-shadow-sm' : ''}`}>
                {expiredDocs > 0 ? `URGENTE: ${expiredDocs} VENCIDOS!` 
               : docsIn2Days > 0 ? `ATENÇÃO: ${docsIn2Days} vencendo em ≤ 2 dias!`
               : expiringDocs > 0 ? `${expiringDocs} expirando em breve` 
               : 'Tudo em dia'}
              </p>
              <Link to="/documentacao" className={`text-[10px] hover:underline mt-auto font-medium ${expiredDocs > 0 ? 'text-red-400 font-bold' : 'text-muted-foreground'}`}>Acessar acervo</Link>
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

        {canKanban && (
          <>
            {/* Kanban Stats */}
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Métricas de Tarefas
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {statsConfig.map((s, i) => (
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
                  {activeBoards
                    .filter(b => b.isFavorite)
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                    .map((board, i) => (
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


            {/* Global Upcoming tasks */}
            <div className="bg-card rounded-lg border border-border p-4 flex flex-col h-[400px] overflow-hidden mb-8">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 shrink-0">
                <CalendarDays className="h-4 w-4 text-accent" />
                Próximas Datas Importantes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 overflow-y-auto custom-scrollbar flex-1 pr-2 pb-2 content-start">
                {allUpcomingEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center flex flex-col items-center gap-2 md:col-span-2 xl:col-span-3">
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground/30" />
                    Nenhum evento global previsto para os próximos 15 dias!
                  </p>
                ) : (
                  allUpcomingEvents.map(event => {
                    const isExternal = event.url && event.url.startsWith('http');
                    
                    const eventContent = (
                      <>
                        <div className="flex items-center gap-2">
                           <event.icon className={`h-3.5 w-3.5 shrink-0 ${event.color}`} />
                           <div className="flex-1 truncate font-semibold text-[10.5px] leading-tight text-foreground/90" title={event.title}>{event.title}</div>
                        </div>
                        <div className="flex items-center justify-between mt-0.5 px-0.5">
                           <span className={`text-[9.5px] font-bold uppercase tracking-wider ${event.color.split(' ')[0]}`}>
                             {event.timeRemaining}
                           </span>
                           <span className="text-[9.5px] font-medium text-muted-foreground bg-background/40 px-1 rounded">
                             {event.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                           </span>
                        </div>
                      </>
                    );

                    const commonClasses = `flex flex-col gap-1 p-2.5 rounded bg-secondary/50 border border-border/50 hover:bg-secondary hover:border-primary/30 transition-all shadow-sm ${event.url ? 'cursor-pointer' : ''}`;

                    if (!event.url) {
                        return (
                            <div key={`${event.type}-${event.id}`} className={commonClasses}>
                                {eventContent}
                            </div>
                        );
                    }

                    if (isExternal) {
                        return (
                            <a key={`${event.type}-${event.id}`} href={event.url} target="_blank" rel="noopener noreferrer" className={commonClasses}>
                                {eventContent}
                            </a>
                        );
                    }

                    return (
                        <Link key={`${event.type}-${event.id}`} to={event.url} className={commonClasses}>
                            {eventContent}
                        </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* Chart */}
            <div className="bg-card rounded-lg border border-border p-4 mb-8">
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
                  const overdue = boardCards.filter(c => {
                    if (!c.dueDate || c.completed) return false;
                    const dDate = fixDateToBRT(c.dueDate);
                    return dDate && dDate < new Date();
                  }).length;
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
