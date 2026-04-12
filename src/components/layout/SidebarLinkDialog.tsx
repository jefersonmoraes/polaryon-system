import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useSidebarLinkStore } from '@/store/sidebar-link-store';
import { toast } from 'sonner';
import { Star } from 'lucide-react';

interface SidebarLinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: string;
}

const SidebarLinkDialog = ({ open, onOpenChange, category }: SidebarLinkDialogProps) => {
    const { addLink } = useSidebarLinkStore();
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setTitle('');
            setUrl('');
            setIsFavorite(false);
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!title.trim() || !url.trim()) {
            toast.error('Preencha o título e a URL');
            return;
        }

        // Add https:// if missing
        let formattedUrl = url.trim();
        if (!/^https?:\/\//i.test(formattedUrl)) {
            formattedUrl = 'https://' + formattedUrl;
        }

        setIsSubmitting(true);
        try {
            await addLink({
                title: title.trim(),
                url: formattedUrl,
                category,
                isFavorite
            });
            toast.success('Link adicionado com sucesso!');
            onOpenChange(false);
        } catch (error) {
            toast.error('Erro ao adicionar link');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-background border border-border">
                <DialogHeader>
                    <DialogTitle>Adicionar Novo Link</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Título</label>
                        <input
                            id="sidebar-link-title"
                            name="linkTitle"
                            required
                            autoFocus
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Google"
                            className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">URL</label>
                        <input
                            id="sidebar-link-url"
                            name="linkUrl"
                            required
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Ex: google.com"
                            className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                        />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsFavorite(!isFavorite)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isFavorite ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' : 'bg-secondary/50 text-muted-foreground border border-border'}`}
                        >
                            <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-yellow-600' : ''}`} />
                            Favorito
                        </button>
                    </div>

                    <DialogFooter className="pt-4">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {isSubmitting ? 'Adicionando...' : 'Adicionar Link'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default SidebarLinkDialog;
