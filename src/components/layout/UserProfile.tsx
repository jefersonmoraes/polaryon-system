import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { LogOut, User, Camera, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function UserProfile() {
    const { currentUser, updateProfile, logout } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(currentUser?.name || '');
    const [editPhoto, setEditPhoto] = useState(currentUser?.photoURL || '');

    if (!currentUser) return null;

    const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '?';

    const handleSave = () => {
        if (!editName.trim()) {
            toast.error("O nome não pode ficar vazio.");
            return;
        }
        updateProfile({
            name: editName.trim(),
            photoURL: editPhoto.trim() || undefined
        });
        setIsEditing(false);
        toast.success("Perfil atualizado com sucesso.");
    };

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
                            <div className="relative w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold mb-3 overflow-hidden shadow-inner border border-primary/20">
                                {currentUser.photoURL ? (
                                    <img src={currentUser.photoURL} alt={currentUser.name} className="w-full h-full object-cover" />
                                ) : (
                                    initial
                                )}
                            </div>

                            {!isEditing ? (
                                <>
                                    <h3 className="font-bold text-sm text-center truncate w-full px-2">{currentUser.name}</h3>
                                    <p className="text-xs text-muted-foreground truncate w-full text-center">{currentUser.email}</p>

                                    <div className="mt-3 flex gap-2">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${currentUser.role === 'ADMIN' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                                            {currentUser.role}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full space-y-3 mt-1">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Nome de exibição</label>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">URL da Foto (Opcional)</label>
                                        <input
                                            type="text"
                                            value={editPhoto}
                                            onChange={e => setEditPhoto(e.target.value)}
                                            placeholder="https://..."
                                            className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-1">
                                        <button onClick={() => setIsEditing(false)} className="text-xs px-3 py-1.5 rounded hover:bg-secondary transition-colors">Cancelar</button>
                                        <button onClick={handleSave} className="text-xs font-bold px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Salvar</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions Body */}
                        {!isEditing && (
                            <div className="p-2 space-y-1">
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md hover:bg-secondary transition-colors"
                                >
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    Editar Perfil
                                </button>

                                {currentUser.role === 'ADMIN' && (
                                    <button
                                        onClick={() => {
                                            setIsOpen(false);
                                            // Navigation is handled outside or by parent if needed, 
                                            // but generally we can use window.location or navigate via a prop
                                            window.location.href = '/admin';
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md hover:bg-primary/10 text-primary transition-colors"
                                    >
                                        <ShieldAlert className="w-4 h-4" />
                                        Painel Admin
                                    </button>
                                )}

                                <div className="h-px bg-border my-1 mx-2" />

                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sair do Sistema
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
