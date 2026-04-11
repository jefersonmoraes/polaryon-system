import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Database, Download, ShieldCheck, AlertTriangle, Play, Loader2 } from 'lucide-react';

interface BackupStatus {
    fileName: string;
    sizeBytes: number;
    createdAt: string;
    status: 'healthy' | 'error';
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const BackupsPage = () => {
    const [backups, setBackups] = useState<BackupStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [forcing, setForcing] = useState(false);

    const fetchBackups = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/backups');
            setBackups(data);
        } catch (error) {
            console.error('Erro ao buscar backups:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    const handleForceBackup = async () => {
        if (!confirm('Deseja forçar a execução de um novo backup?')) return;
        try {
            setForcing(true);
            await api.post('/backups/force');
            await fetchBackups();
        } catch (error) {
            console.error('Falha ao forçar backup', error);
            alert('Falha ao forçar o backup. Verifique os logs do servidor.');
        } finally {
            setForcing(false);
        }
    };

    return (
        <div className="flex-1 bg-background text-foreground overflow-hidden flex flex-col">
            <div className="kanban-header h-12 flex items-center px-4 shrink-0 border-b border-border z-10 gap-4">
                <h1 className="font-bold text-lg text-white">BACKUPS DE SEGURANÇA</h1>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={handleForceBackup}
                        disabled={forcing}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {forcing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Forçar Backup
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-muted/10 border border-border p-5 rounded-xl flex items-start gap-4 shadow-sm">
                        <div className="p-3 bg-emerald-500/10 rounded-lg shrink-0">
                            <ShieldCheck className="h-8 w-8 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Rotina de Backup Automático Ativa</h2>
                            <p className="text-sm text-muted-foreground mt-1">O sistema está programado para verificar e realizar backups de segurança diariamente às <b>03:00 (Brasília)</b>. Apenas os 2 backups mais recentes são mantidos para economizar espaço em disco. O banco de dados PostgreSQL é arquivado via <code>pg_dump</code>.</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-border bg-muted/20">
                            <h3 className="font-bold text-sm tracking-wide uppercase">Últimos Backups ({backups.length}/2)</h3>
                        </div>
                        
                        {loading ? (
                            <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                                Buscando histórico...
                            </div>
                        ) : backups.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground flex flex-col items-center bg-muted/5">
                                <Database className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                <p className="font-medium text-lg">Nenhum backup encontrado</p>
                                <p className="text-sm">O sistema criará o seu primeiro backup na próxima execução automática ou você pode forçar um backup agora.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {backups.map((backup, i) => (
                                    <div key={i} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${backup.status === 'healthy' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                                {backup.status === 'healthy' ? (
                                                    <Database className="h-5 w-5 text-emerald-500" />
                                                ) : (
                                                    <AlertTriangle className="h-5 w-5 text-rose-500" />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm">{backup.fileName}</h4>
                                                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-medium">
                                                    <span>{new Date(backup.createdAt).toLocaleString('pt-BR')}</span>
                                                    <span>•</span>
                                                    <span>{formatBytes(backup.sizeBytes)}</span>
                                                    <span>•</span>
                                                    <span className={backup.status === 'healthy' ? 'text-emerald-500' : 'text-rose-500'}>
                                                        {backup.status === 'healthy' ? 'SAUDÁVEL' : 'ERRO - ARQUIVO VAZIO'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
