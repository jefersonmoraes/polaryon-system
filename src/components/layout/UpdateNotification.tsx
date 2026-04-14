import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UpdateNotification() {
    const [updateInfo, setUpdateInfo] = useState<any>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI) return;

        // Listen for "Update Available"
        const handleUpdateAvailable = (info: any) => {
            setUpdateInfo(info);
            toast.info(`Nova versão disponível: v${info.version}`, {
                description: "O download começará automaticamente em segundo plano.",
                icon: <Download className="h-4 w-4" />,
            });
        };

        // Listen for "Download Progress"
        const handleDownloadProgress = (progress: any) => {
            setDownloadProgress(Math.round(progress.percent));
        };

        // Listen for "Update Downloaded"
        const handleUpdateDownloaded = (info: any) => {
            setIsDownloaded(true);
            setDownloadProgress(100);
            
            toast.success("Atualização concluída!", {
                description: "Uma nova versão do Polaryon está pronta para ser instalada.",
                duration: Infinity,
                action: {
                    label: "REINICIAR E ATUALIZAR",
                    onClick: () => electronAPI.installUpdate(),
                },
            });
        };

        // Listen for "Update Error"
        const handleUpdateError = (err: string) => {
            setError(err);
            toast.error("Erro na atualização automática", {
                description: err,
                icon: <AlertTriangle className="h-4 w-4" />,
            });
        };

        electronAPI.onUpdateAvailable(handleUpdateAvailable);
        electronAPI.onDownloadProgress(handleDownloadProgress);
        electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
        electronAPI.onUpdateError(handleUpdateError);

    }, []);

    // We don't render anything visible directly, but we could show a progress bar in the bottom right
    if (!updateInfo || error) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-right duration-300">
            {updateInfo && !isDownloaded && (
                <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-2xl flex flex-col gap-3 min-w-[280px]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
                            <span className="text-xs font-bold text-slate-100 uppercase tracking-tighter">Baixando Versão {updateInfo.version}</span>
                        </div>
                        <span className="text-xs font-black text-blue-400 font-mono">{downloadProgress}%</span>
                    </div>
                    
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300" 
                            style={{ width: `${downloadProgress}%` }}
                        />
                    </div>
                    
                    <p className="text-[10px] text-slate-500 italic">O Polaryon será atualizado no próximo reinício.</p>
                </div>
            )}

            {isDownloaded && (
                <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 p-4 rounded-xl shadow-2xl flex flex-col gap-3 min-w-[280px]">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-tighter">Pronto para Instalar!</span>
                    </div>
                    
                    <Button 
                        onClick={() => (window as any).electronAPI.installUpdate()}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs transition-all active:scale-95"
                    >
                        REINICIAR AGORA
                    </Button>
                </div>
            )}
        </div>
    );
}
