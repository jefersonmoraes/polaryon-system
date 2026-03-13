import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { LogOut, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function UserProfile() {
    const { currentUser, logout } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);

    if (!currentUser) return null;

    const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '?';

    const handleLogout = () => {
        setIsOpen(false);
        logout();
        toast.info("Você saiu do sistema.");
    };

    return (
        <div className="relative">
            {/* Avatar Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="h-8 w-8 rounded-full bg-accent hover:bg-accent/80 transition-colors flex items-center justify-center text-xs font-bold text-accent-foreground ml-2 overflow-hidden border-2 border-transparent hover:border-white/20"
                title="Meu Perfil"
            >
                {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                    initial
                )}
            </button>

            {/* Popover/Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40 bg-black/20"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Content */}
                    <div className="absolute top-full right-0 mt-2 w-72 bg-popover border border-border shadow-2xl rounded-xl z-50 text-foreground overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                        {/* Header Box */}
                        <div className="p-4 bg-muted/30 border-b border-border flex flex-col items-center">
                            <div className="relative w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold mb-3 overflow-hidden shadow-sm border border-border group gap-2">
                                {currentUser.photoURL ? (
                                    <img src={currentUser.photoURL} alt={currentUser.name} className="w-full h-full object-cover" />
                                ) : (
                                    initial
                                )}
                            </div>

                            <h3 className="font-bold text-sm text-center truncate w-full px-2">{currentUser.name}</h3>
                            <p className="text-xs text-muted-foreground truncate w-full text-center mt-1 mb-2">{currentUser.email}</p>

                            <div className="mt-2 flex gap-2 justify-center w-full">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${currentUser.role === 'ADMIN' ? 'bg-primary/20 text-primary border-primary/30' : (currentUser.role === 'CONTADOR' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'bg-secondary text-muted-foreground border-border')}`}>
                                    {currentUser.role}
                                </span>
                                {currentUser.role === 'ADMIN' && (
                                    <span className="text-[10px] bg-red-500/10 text-red-500 font-bold px-2 py-0.5 rounded-full border border-red-500/20 flex items-center gap-1">
                                        <ShieldAlert className="w-3 h-3" /> Acesso Total
                                    </span>
                                )}
                            </div>
                            
                            {/* Warning message since they can no longer edit here */}
                            <div className="text-[10px] text-muted-foreground text-center mt-4 bg-secondary/50 p-2 rounded w-full">
                                A foto e o nome do seu perfil são gerenciados automaticamente e sincronizados com a <b>Sua Conta Google</b>.
                            </div>
                        </div>

                        {/* Actions Body */}
                        <div className="p-2 space-y-1 bg-background">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-destructive rounded-md hover:bg-destructive/10 transition-colors group"
                            >
                                <span className="group-hover:pl-1 transition-all">Sair do Sistema</span>
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
