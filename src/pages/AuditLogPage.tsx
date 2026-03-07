import { useState, useMemo } from 'react';
import { useAuditStore } from '@/store/audit-store';
import { useAuthStore } from '@/store/auth-store';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Navigate } from 'react-router-dom';
import { Search, ShieldAlert, ArrowLeftRight, Clock, User, Box, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import AppHeader from '@/components/layout/AppHeader';
import AppSidebar from '@/components/layout/AppSidebar';

const ACTION_COLORS: Record<string, string> = {
    CRIAR: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    EDITAR: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    EXCLUIR: 'bg-red-500/10 text-red-600 border-red-500/20',
    MOVER: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    STATUS: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    LOGIN: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    SISTEMA: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

const AuditLogPage = () => {
    const { logs } = useAuditStore();
    const { currentUser } = useAuthStore();

    // States for filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<string>('todos');
    const [selectedActions, setSelectedActions] = useState<string>('todos');
    const [selectedEntities, setSelectedEntities] = useState<string>('todos');

    // Ensure only admins can access
    if (currentUser?.role !== 'ADMIN') {
        return <Navigate to="/" replace />;
    }

    // Get unique entities and users for the dropdowns
    const uniqueUsers = useMemo(() => {
        const users = new Map();
        logs.forEach(log => {
            if (!users.has(log.userId)) {
                users.set(log.userId, log.userName);
            }
        });
        return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
    }, [logs]);

    const uniqueEntities = useMemo(() => {
        return Array.from(new Set(logs.map(log => log.entity))).sort();
    }, [logs]);

    const uniqueActions = useMemo(() => {
        return Array.from(new Set(logs.map(log => log.action))).sort();
    }, [logs]);

    // Apply filters
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Free text search (details, userName, entity)
            const matchesSearch = searchTerm === '' ||
                log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.entity.toLowerCase().includes(searchTerm.toLowerCase());

            // User filter
            const matchesUser = selectedUsers === 'todos' || log.userId === selectedUsers;

            // Action filter
            const matchesAction = selectedActions === 'todos' || log.action === selectedActions;

            // Entity filter
            const matchesEntity = selectedEntities === 'todos' || log.entity === selectedEntities;

            return matchesSearch && matchesUser && matchesAction && matchesEntity;
        });
    }, [logs, searchTerm, selectedUsers, selectedActions, selectedEntities]);

    return (
        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-muted/30 p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <ShieldAlert className="h-6 w-6 text-primary" />
                            Histórico de Ações
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Trilha de auditoria centralizada. Visualize e rastreie todas as alterações importantes no sistema.
                        </p>
                    </div>
                    <Button variant="outline" className="gap-2" onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8," +
                            "Data/Hora;Usuário;Ação;Módulo;Detalhes\n" +
                            filteredLogs.map(l => `"${format(new Date(l.timestamp), 'dd/MM/yyyy HH:mm:ss')}";"${l.userName}";"${l.action}";"${l.entity}";"${l.details}"`).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `auditoria_kunbun_${format(new Date(), 'dd_MM_yyyy')}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}>
                        <Download className="h-4 w-4" /> Exportar CSV
                    </Button>
                </div>

                {/* Filters Area */}
                <Card className="border-border shadow-sm">
                    <CardContent className="p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                            {/* Search */}
                            <div className="space-y-1.5 min-w-[200px]">
                                <label className="text-xs font-semibold text-muted-foreground uppercase">Buscar Registros</label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por detalhes, nomes..."
                                        className="pl-9 bg-background"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* User Filter */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5" /> Filtrar por Usuário
                                </label>
                                <Select value={selectedUsers} onValueChange={setSelectedUsers}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Todos os usuários" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos os usuários ({uniqueUsers.length})</SelectItem>
                                        {uniqueUsers.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Entity Filter */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                                    <Box className="h-3.5 w-3.5" /> Filtrar por Módulo
                                </label>
                                <Select value={selectedEntities} onValueChange={setSelectedEntities}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Todos os módulos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos os módulos</SelectItem>
                                        {uniqueEntities.map(e => (
                                            <SelectItem key={e} value={e}>{e}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Action Filter */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                                    <ArrowLeftRight className="h-3.5 w-3.5" /> Tipo de Ação
                                </label>
                                <Select value={selectedActions} onValueChange={setSelectedActions}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Todas as ações" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todas as ações</SelectItem>
                                        {uniqueActions.map(a => (
                                            <SelectItem key={a} value={a}>{a}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                        </div>
                    </CardContent>
                </Card>

                {/* Data Table */}
                <Card className="border-border shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-muted text-muted-foreground uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-4 py-3 min-w-[150px]">Data e Hora</th>
                                    <th className="px-4 py-3 min-w-[180px]">Usuário</th>
                                    <th className="px-4 py-3 min-w-[120px]">Ação</th>
                                    <th className="px-4 py-3 min-w-[120px]">Módulo</th>
                                    <th className="px-4 py-3 w-full min-w-[300px]">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                                            Nenhum registro encontrado para os filtros selecionados.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                                            <td className="px-4 py-3 text-muted-foreground text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3 shrink-0" />
                                                    {format(new Date(log.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                        {log.userName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-foreground">{log.userName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ACTION_COLORS[log.action] || 'bg-gray-500/10 text-gray-600 border-gray-500/20'}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-foreground text-xs">{log.entity}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-muted-foreground whitespace-normal line-clamp-2" title={log.details}>
                                                    {log.details}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t border-border bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
                        <span>
                            Mostrando {filteredLogs.length} registro(s) de um total de {logs.length}.
                        </span>
                        <span>
                            Apenas as últimas 5.000 ações são retidas localmente.
                        </span>
                    </div>
                </Card>

            </div>
        </div>
    );
};

export default AuditLogPage; 
