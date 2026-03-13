import { useState, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useKanbanStore } from '@/store/kanban-store';
import { LogOut, User, Camera, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function UserProfile() {
    const { currentUser, updateProfile, logout } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(currentUser?.name || '');
    const [editPhoto, setEditPhoto] = useState(currentUser?.photoURL || '');
    const fileInputRef = useRef<HTMLInputElement>(null);

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

        // Cascata automática para o Kanban e Equipe
        const kanbanStore = useKanbanStore.getState();
        const updatedMembers = kanbanStore.members.map(m => 
            m.id === currentUser.id 
                ? { ...m, name: editName.trim(), avatar: editPhoto.trim() || '' }
                : m
        );
        kanbanStore.setMembers(updatedMembers);

        setIsEditing(false);
        toast.success("Perfil atualizado com sucesso.");
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error("Por favor, selecione um arquivo de imagem.");
            return;
        }

        // NOVO: Limite rigoroso de tamanho de arquivo (2MB máximo)
        const MAX_SIZE_MB = 2;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            toast.error(`A imagem é muito grande. O tamanho máximo permitido é de ${MAX_SIZE_MB}MB.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 150;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                    setEditPhoto(compressedBase64);
                } else {
                    setEditPhoto(reader.result as string);
                }
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
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
                            <div className="relative w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold mb-3 overflow-hidden shadow-inner border border-primary/20 group">
                                {isEditing ? (
                                    <>
                                        {editPhoto ? (
                                            <img src={editPhoto} alt={currentUser.name} className="w-full h-full object-cover" />
                                        ) : (
                                            initial
                                        )}
                                        <div
                                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Camera className="w-6 h-6 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    currentUser.photoURL ? (
                                        <img src={currentUser.photoURL} alt={currentUser.name} className="w-full h-full object-cover" />
                                    ) : (
                                        initial
                                    )
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
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Foto do Perfil</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="flex-1 bg-secondary text-secondary-foreground text-xs py-1.5 rounded flex items-center justify-center gap-1.5 font-medium hover:bg-secondary/80 transition-colors"
                                            >
                                                <Camera className="w-3.5 h-3.5" />
                                                Enviar Foto
                                            </button>
                                            {editPhoto && (
                                                <button
                                                    onClick={() => setEditPhoto('')}
                                                    className="px-2 bg-destructive/10 text-destructive text-xs py-1.5 rounded hover:bg-destructive/20 transition-colors font-medium"
                                                >
                                                    Remover
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="image/png, image/jpeg, image/jpg, image/webp"
                                            className="hidden"
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
