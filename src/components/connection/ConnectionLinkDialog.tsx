import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConnectionStore } from '@/store/connection-store';

interface ConnectionLinkDialogProps {
    defaultFolderId?: string;
}

const ConnectionLinkDialog: React.FC<ConnectionLinkDialogProps> = ({ defaultFolderId }) => {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [description, setDescription] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    const [folderId, setFolderId] = useState('');

    const { 
        folders, addLink, updateLink, 
        isLinkDialogOpen, setLinkDialogOpen, editingLink 
    } = useConnectionStore();

    useEffect(() => {
        if (editingLink) {
            setTitle(editingLink.title);
            setUrl(editingLink.url);
            setDescription(editingLink.description || '');
            setIsFavorite(editingLink.isFavorite);
            setFolderId(editingLink.folderId);
        } else {
            setTitle('');
            setUrl('');
            setDescription('');
            setIsFavorite(false);
            setFolderId(defaultFolderId || (folders.length > 0 ? folders[0].id : ''));
        }
    }, [editingLink, isLinkDialogOpen, defaultFolderId, folders]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !url.trim() || !folderId) return;

        // Ensure URL has protocol
        let finalUrl = url.trim();
        if (!/^https?:\/\//i.test(finalUrl)) {
            finalUrl = 'https://' + finalUrl;
        }

        const data = { title, url: finalUrl, description, isFavorite, folderId };

        if (editingLink) {
            await updateLink(editingLink.id, data);
        } else {
            await addLink(data);
        }
        setLinkDialogOpen(false);
    };

    return (
        <Dialog open={isLinkDialogOpen} onOpenChange={(open) => setLinkDialogOpen(open)}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingLink ? 'Editar Link' : 'Novo Link'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="folder">Pasta</Label>
                        <Select value={folderId} onValueChange={setFolderId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione uma pasta" />
                            </SelectTrigger>
                            <SelectContent>
                                {folders.map((f) => (
                                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="title">Título</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Google Workspace, Site do Cliente..."
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="url">URL do Link</Label>
                        <Input
                            id="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Ex: google.com.br"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição (Opcional)</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Pequeno detalhe sobre o link..."
                            className="resize-none h-20"
                        />
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <Switch
                            id="favorite"
                            checked={isFavorite}
                            onCheckedChange={setIsFavorite}
                        />
                        <Label htmlFor="favorite">Favoritar para acesso rápido</Label>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!title.trim() || !url.trim() || !folderId}>
                            {editingLink ? 'Salvar Alterações' : 'Adicionar Link'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ConnectionLinkDialog;
