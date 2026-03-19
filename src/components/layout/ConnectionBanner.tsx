import { WifiOff, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

export const ConnectionBanner = () => {
    const isSocketConnected = useAuthStore(state => state.isSocketConnected);

    if (isSocketConnected) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] animate-in slide-in-from-top duration-300">
            <div className="bg-amber-500 text-amber-950 px-4 py-2 shadow-lg flex items-center justify-center gap-3">
                <div className="bg-amber-950/20 p-1.5 rounded-full animate-pulse">
                    <WifiOff className="h-4 w-4" />
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Conexão com o servidor perdida
                    </span>
                    <span className="text-[10px] sm:text-xs opacity-80 font-medium">
                        Tentando restabelecer comunicação em tempo real automaticamente...
                    </span>
                </div>
            </div>
        </div>
    );
};
