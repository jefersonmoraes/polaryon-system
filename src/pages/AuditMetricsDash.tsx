import { useMemo } from 'react';
import { useAuditStore, EntityType, ActionType } from '@/store/audit-store';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Activity, Users, LayoutTemplate, MousePointerClick, Download } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ed6c02', '#2e7d32'];

type ActionCounts = {
    [key in ActionType]?: number;
};
type EntityCounts = {
    [key in string]?: number;
};

export const AuditMetricsDash = () => {
    const { logs } = useAuditStore();

    const today = new Date();
    const last30Days = useMemo(() => Array.from({ length: 30 }).map((_, i) => subDays(today, 29 - i)), []);

    // 1. Actions over time (Last 30 days)
    const timelineData = useMemo(() => {
        return last30Days.map(date => {
            const dayStart = startOfDay(date);
            const dayEnd = endOfDay(date);

            const logsInDay = logs.filter(log => {
                const logDate = new Date(log.timestamp);
                return isWithinInterval(logDate, { start: dayStart, end: dayEnd });
            });

            return {
                date: format(date, 'dd/MM'),
                acoes: logsInDay.length
            };
        });
    }, [logs, last30Days]);

    // 2. Activity per Entity
    const entityData = useMemo(() => {
        const counts = logs.reduce((acc: EntityCounts, log) => {
            acc[log.entity] = (acc[log.entity] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => (b.value || 0) - (a.value || 0));
    }, [logs]);

    // 3. User Activity (Top 5)
    const userData = useMemo(() => {
        const counts = logs.reduce((acc: Record<string, { name: string, count: number }>, log) => {
            if (!acc[log.userId]) {
                acc[log.userId] = { name: log.userName, count: 0 };
            }
            acc[log.userId].count += 1;
            return acc;
        }, {});

        return Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(item => ({ name: item.name.split(' ')[0], acoes: item.count }));
    }, [logs]);

    // 4. Activity Types
    const actionTypeData = useMemo(() => {
        const counts = logs.reduce((acc: ActionCounts, log) => {
            acc[log.action] = (acc[log.action] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [logs]);

    const handleExportCSV = () => {
        // Headers
        const headers = ['ID', 'Data/Hora', 'Usuário', 'Ação', 'Módulo', 'Detalhes'];

        // Rows
        const rows = logs.map(log => [
            log.id,
            format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss'),
            `"${log.userName}"`, // wrap in quotes to escape potential commas
            log.action,
            log.entity,
            `"${log.details.replace(/"/g, '""')}"` // escape double quotes
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `auditoria_polaryon_${format(today, 'dd_MM_yyyy')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Métricas de Auditoria
                </h2>
                <button
                    onClick={handleExportCSV}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold rounded-md transition-colors border border-border min-h-[44px]"
                >
                    <Download className="h-3.5 w-3.5" /> Exportar Logs (CSV)
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-lg shrink-0">
                        <Activity className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Total de Ações Registradas</p>
                        <h3 className="text-2xl font-bold">{logs.length}</h3>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg shrink-0">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Usuários Ativos (Hoje)</p>
                        <h3 className="text-2xl font-bold">
                            {new Set(logs.filter(l => isWithinInterval(new Date(l.timestamp), { start: startOfDay(today), end: endOfDay(today) })).map(l => l.userId)).size}
                        </h3>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                        <LayoutTemplate className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Principal Módulo Acessado</p>
                        <h3 className="text-xl font-bold truncate">{entityData[0]?.name || 'N/A'}</h3>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-orange-500/10 text-orange-500 rounded-lg shrink-0">
                        <MousePointerClick className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Média Ações/Dia (30d)</p>
                        <h3 className="text-2xl font-bold">
                            {Math.round(timelineData.reduce((acc, curr) => acc + curr.acoes, 0) / 30)}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Timeline */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Ações por Dia (Últimos 30 dias)</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timelineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="date" stroke="#888" fontSize={12} tickMargin={10} minTickGap={20} />
                                <YAxis stroke="#888" fontSize={12} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e1e24', borderColor: '#333', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Line type="monotone" dataKey="acoes" name="Ações" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Users */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Top 5 Usuários Mais Ativos</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={userData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="name" stroke="#888" fontSize={12} tickMargin={10} />
                                <YAxis stroke="#888" fontSize={12} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e1e24', borderColor: '#333', color: '#fff' }}
                                    cursor={{ fill: '#ffffff10' }}
                                />
                                <Bar dataKey="acoes" name="Total Ações" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Entities Distribution */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Uso por Módulo do Sistema</h3>
                    <div className="h-[250px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={entityData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {entityData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1e1e24', borderColor: '#333', color: '#fff' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Action Types Distribution */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Tipos de Ação</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={actionTypeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {actionTypeData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1e1e24', borderColor: '#333', color: '#fff' }} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
