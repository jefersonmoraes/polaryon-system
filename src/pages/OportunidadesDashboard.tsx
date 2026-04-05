import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, Search, Calendar, MapPin, Building2, ExternalLink, Filter, Loader2, AlertCircle, BarChart3, TrendingUp, TrendingDown, BookOpen, Clock, LayoutDashboard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';

// Métricas Fictícias Baseadas no Mercado Nacional PNCP (Exemplo de Snapshot Recente)
// Em um sistema real, essas métricas viriam de um Endpoint do Backend que faz o cache diário do PNCP
const pncpMetricsSnapshot = {
    totalLicitacoesAtivas: 121050,
    orcamentoEstimadoAberto: 45000000000, // 45 Bilhões
    mediaDiasDisputa: 14,
    principaisModalidades: [
        { name: 'Dispensa', value: 45 },
        { name: 'Pregão Eletrônico', value: 35 },
        { name: 'Concorrência', value: 15 },
        { name: 'Inexigibilidade', value: 5 }
    ],
    esferasAbertura: [
        { name: 'Municipal', value: 65 },
        { name: 'Federal', value: 20 },
        { name: 'Estadual', value: 15 }
    ],
    evolucaoMensal: [
        { mes: 'Ago', qtd: 9500 },
        { mes: 'Set', qtd: 10200 },
        { mes: 'Out', qtd: 11050 },
        { mes: 'Nov', qtd: 12500 },
        { mes: 'Dez', qtd: 8300 },
        { mes: 'Jan', qtd: 14200 },
    ]
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
const DONUT_COLORS = ['#0ea5e9', '#8b5cf6', '#f43f5e'];

export default function OportunidadesDashboard() {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        
        const loadMetrics = async () => {
            if (!isMounted) return;
            try {
                const res = await import('@/lib/api').then(m => m.default.get('/transparency/national-thermometer'));
                if (isMounted && res.data?.success) {
                    setMetrics(res.data);
                }
            } catch (err) {
                console.error('Failed to load national metrics', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        // Initial load
        loadMetrics();

        // Refresh when gaining window focus
        window.addEventListener('focus', loadMetrics);

        // Refresh periodically if staying on screen (every 5 min)
        const interval = setInterval(loadMetrics, 5 * 60 * 1000);

        return () => {
            isMounted = false;
            window.removeEventListener('focus', loadMetrics);
            clearInterval(interval);
        };
    }, []);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground font-medium animate-pulse">Atualizando métricas nacionais do PNCP...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-background text-foreground p-6 min-h-full">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                                <LayoutDashboard className="h-6 w-6" />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">Termômetro Nacional</h1>
                        </div>
                        <p className="text-muted-foreground">Visão geral e inteligência de mercado baseada nos editais públicos ativos em Gov.br.</p>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all"></div>
                        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                            <Target className="h-4 w-4 text-blue-500" />
                            <h3 className="text-sm font-medium">Oportunidades Ativas</h3>
                        </div>
                        <div className="text-3xl font-bold flex items-end gap-2 text-blue-500">
                            {(metrics.totalActive || 0).toLocaleString('pt-BR')}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Editais recebendo propostas no PNCP</p>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-orange-500/10 rounded-full blur-xl group-hover:bg-orange-500/20 transition-all"></div>
                        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                            <Filter className="h-4 w-4 text-orange-500" />
                            <h3 className="text-sm font-medium">Publicadas Hoje</h3>
                        </div>
                        <div className="text-3xl font-bold text-orange-500 flex items-center gap-2">
                            {metrics.todayCount || 0}
                            {metrics.todayCount > (metrics.weeklyAvg || 0) && (
                                <span className="text-[10px] bg-orange-500/20 text-orange-600 px-1.5 py-0.5 rounded-full font-bold animate-pulse">ALTA</span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Novos editais inseridos nas últimas 24h</p>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
                        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                            <Calendar className="h-4 w-4 text-amber-500" />
                            <h3 className="text-sm font-medium">Média Diária (Semana)</h3>
                        </div>
                        <div className="text-3xl font-bold text-foreground">
                            {metrics.weeklyAvg || 0} <span className="text-sm text-muted-foreground">ed/dia</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Volume médio nos últimos 7 dias</p>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
                        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                            <h3 className="text-sm font-medium">Orçamento Estimado</h3>
                        </div>
                        <div className="text-3xl font-bold text-foreground">
                            R$ 45 <span className="text-xl">Bi</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Volume financeiro global aproximado</p>
                    </div>
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    {/* Bar Chart - Abertura por Nicho */}
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold flex items-center gap-2 mb-6 text-foreground">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Volume por Nicho de Mercado (Ativos)
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={metrics.nicheDistribution} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(var(--foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                        cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                                    />
                                    <Bar dataKey="value" name="Editais" radius={[0, 4, 4, 0]}>
                                        {metrics.nicheDistribution?.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Line Chart - Evolução Mensal */}
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold flex items-center gap-2 mb-6 text-foreground">
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                            Sazonalidade de Abertura (Qtd Editais)
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={metrics.evolucaoMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                        labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                                    />
                                    <Line type="monotone" dataKey="qtd" name="Editais Abertos" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Pie Chart - Esferas Governamentais */}
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm lg:col-span-2">
                        <h3 className="text-sm font-bold flex items-center gap-2 mb-6 text-foreground">
                            <Building2 className="h-4 w-4 text-rose-500" />
                            Concentração por Esfera Governamental
                        </h3>
                        <div className="h-[250px] flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={metrics.esferasAbertura}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        nameKey="name"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {metrics.esferasAbertura.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-center text-muted-foreground mt-4">
                            Em sua esmagadora maioria, prefeituras lideram o número de aberturas de pequenos processos de licitação e compras diretas via PNCP. As grandes licitações volumétricas dominam a esfera Federal.
                        </p>
                    </div>
                </div>

            </motion.div>
        </div>
    );
}
