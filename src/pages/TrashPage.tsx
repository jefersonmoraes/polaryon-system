import { useKanbanStore } from '@/store/kanban-store';
import { Trash2, Undo2, Clock, LayoutGrid, Folder, List, CreditCard, Search, X, Building2, MapPin, Route as RouteIcon } from 'lucide-react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { ConfirmAction } from '@/components/ui/ConfirmAction';
import CardDetailPanel from '@/components/board/CardDetailPanel';

const TrashPage = () => {
    const { 
        cards, lists, boards, folders, budgets, companies, routes,
        updateCard, updateList, updateBoard, updateFolder, restoreBudget, restoreCompany, restoreRoute,
        permanentlyDeleteCard, permanentlyDeleteList, permanentlyDeleteBoard, permanentlyDeleteFolder, permanentlyDeleteBudget, permanentlyDeleteCompany, permanentlyDeleteRoute,
        members 
    } = useKanbanStore();
    
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'cards' | 'lists' | 'boards' | 'folders' | 'budgets' | 'companies' | 'routes'>('all');
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const { currentUser } = useAuthStore();

    const trashedItems = useMemo(() => {
        const items: any[] = [];
        
        if (filter === 'all' || filter === 'cards') {
            cards.filter(c => c.trashed).forEach(c => items.push({ ...c, type: 'card', icon: <CreditCard className="h-4 w-4" /> }));
        }
        if (filter === 'all' || filter === 'lists') {
            lists.filter(l => l.trashed).forEach(l => items.push({ ...l, type: 'list', icon: <List className="h-4 w-4" /> }));
        }
        if (filter === 'all' || filter === 'boards') {
            boards.filter(b => b.trashed).forEach(b => items.push({ ...b, type: 'board', icon: <LayoutGrid className="h-4 w-4" /> }));
        }
        if (filter === 'all' || filter === 'folders') {
            folders.filter(f => f.trashed).forEach(f => items.push({ ...f, type: 'folder', icon: <Folder className="h-4 w-4" /> }));
        }
        if (filter === 'all' || filter === 'budgets') {
            budgets.filter(b => b.trashed).forEach(b => items.push({ ...b, type: 'budget', icon: <CreditCard className="h-4 w-4 text-emerald-500" /> }));
        }
        if (filter === 'all' || filter === 'companies') {
            companies.filter(c => c.trashed).forEach(c => items.push({ ...c, type: 'company', icon: <Building2 className="h-4 w-4 text-blue-500" /> }));
        }
        if (filter === 'all' || filter === 'routes') {
            routes.filter(r => r.trashed).forEach(r => items.push({ ...r, type: 'route', icon: <MapPin className="h-4 w-4 text-orange-500" /> }));
        }

        return items
            .filter(item => {
                const title = item.title || item.name || item.nome_fantasia || item.razao_social || '';
                return title.toLowerCase().includes(search.toLowerCase());
            })
            .sort((a, b) => new Date(b.trashedAt || 0).getTime() - new Date(a.trashedAt || 0).getTime());
    }, [cards, lists, boards, folders, budgets, companies, routes, search, filter]);

    const handleRestore = (item: any) => {
        if (item.type === 'card') updateCard(item.id, { trashed: false });
        else if (item.type === 'list') updateList(item.id, { trashed: false });
        else if (item.type === 'board') updateBoard(item.id, { trashed: false });
        else if (item.type === 'folder') updateFolder(item.id, { trashed: false });
        else if (item.type === 'budget') restoreBudget(item.id);
        else if (item.type === 'company') restoreCompany(item.id);
        else if (item.type === 'route') restoreRoute(item.id);
    };

    const handleDelete = (item: any) => {
        if (item.type === 'card') permanentlyDeleteCard(item.id);
        else if (item.type === 'list') permanentlyDeleteList(item.id);
        else if (item.type === 'board') permanentlyDeleteBoard(item.id);
        else if (item.type === 'folder') permanentlyDeleteFolder(item.id);
        else if (item.type === 'budget') permanentlyDeleteBudget(item.id);
        else if (item.type === 'company') permanentlyDeleteCompany(item.id);
        else if (item.type === 'route') permanentlyDeleteRoute(item.id);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            <header className="p-6 border-b border-border bg-card/30 backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-destructive/10 rounded-xl">
                            <Trash2 className="h-6 w-6 text-destructive" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">Lixeira Global</h1>
                            <p className="text-xs text-muted-foreground">Gerencie e restaure itens excluídos recentemente</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar na lixeira..."
                                className="pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 no-scrollbar">
                    {[
                        { id: 'all', label: 'Tudo', icon: <Trash2 className="h-3.5 w-3.5" /> },
                        { id: 'cards', label: 'Cartões', icon: <CreditCard className="h-3.5 w-3.5" /> },
                        { id: 'lists', label: 'Listas', icon: <List className="h-3.5 w-3.5" /> },
                        { id: 'boards', label: 'Quadros', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
                        { id: 'folders', label: 'Pastas', icon: <Folder className="h-3.5 w-3.5" /> },
                        { id: 'budgets', label: 'Orçamentos', icon: <CreditCard className="h-3.5 w-3.5" /> },
                        { id: 'companies', label: 'Empresas', icon: <Building2 className="h-3.5 w-3.5" /> },
                        { id: 'routes', label: 'Rotas Logísticas', icon: <MapPin className="h-3.5 w-3.5" /> },
                    ].map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => setFilter(btn.id as any)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border ${
                                filter === btn.id 
                                    ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                                    : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                            }`}
                        >
                            {btn.icon}
                            {btn.label}
                        </button>
                    ))}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-card/10">
                {trashedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="p-6 bg-muted/30 rounded-full mb-4">
                            <Trash2 className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Lixeira vazia</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mt-2">
                            {search ? 'Nenhum item encontrado para sua busca.' : 'Não há itens deletados recentemente para exibir.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence mode="popLayout">
                            {trashedItems.map(item => (
                                <motion.div
                                    key={`${item.type}-${item.id}`}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="group p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2 px-2 py-1 rounded bg-secondary/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            {item.icon}
                                            {item.type}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {item.trashedAt ? new Date(item.trashedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Data desconhecida'}
                                        </div>
                                    </div>

                                    <h4 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors truncate">
                                        {item.title || item.name || item.nome_fantasia || item.razao_social || 'Sem título'}
                                    </h4>
                                    
                                    <div className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[2rem]">
                                        {item.description || item.summary || item.cnpj || (item.origin ? `Rota: ${item.origin} ➔ ${item.destination}` : 'Nenhuma descrição disponível.')}
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                                        <button 
                                            onClick={() => handleRestore(item)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-xs font-bold transition-all"
                                        >
                                            <Undo2 className="h-3.5 w-3.5" /> Restaurar
                                        </button>

                                        {(currentUser?.role === 'ADMIN' || currentUser?.permissions?.canEdit) && (
                                            <ConfirmAction
                                                title="Excluir Permanentemente?"
                                                description="Esta ação não pode ser desfeita. O item será removido definitivamente do banco de dados."
                                                onConfirm={() => handleDelete(item)}
                                                destructive
                                            >
                                                <button className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-40 group-hover:opacity-100">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </ConfirmAction>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            <AnimatePresence>
                {selectedCardId && (
                    <CardDetailPanel cardId={selectedCardId} onClose={() => setSelectedCardId(null)} />
                )}
            </AnimatePresence>
        </div>
    );
};

export default TrashPage;
