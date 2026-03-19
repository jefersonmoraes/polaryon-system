import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConnectionFolder, useConnectionStore } from '@/store/connection-store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ConnectionFolderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingFolder: ConnectionFolder | null;
}

const ConnectionFolderDialog: React.FC<ConnectionFolderDialogProps> = ({ open, onOpenChange, editingFolder }) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#3b82f6');
    const [parentId, setParentId] = useState<string | 'none'>('none');
    const { folders, addFolder, updateFolder } = useConnectionStore();

    useEffect(() => {
        if (editingFolder) {
            setName(editingFolder.name);
            setColor(editingFolder.color || '#3b82f6');
            setParentId(editingFolder.parentId || 'none');
        } else {
            setName('');
            setColor('#3b82f6');
            setParentId('none');
        }
    }, [editingFolder, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const pId = parentId === 'none' ? null : parentId;

        if (editingFolder) {
            await updateFolder(editingFolder.id, name, color, pId);
        } else {
            await addFolder(name, color, pId);
        }
        onOpenChange(false);
    };

    const colorOptions = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#71717a'
    ];

    // Filter out current folder and its children when editing
    const availableFolders = folders.filter(f => f.id !== editingFolder?.id);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingFolder ? 'Editar Pasta' : 'Nova Pasta'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome da Pasta</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Ferramentas, Documentos..."
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="parent">Pasta Superior (Opcional)</Label>
                        <Select value={parentId} onValueChange={setParentId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione uma pasta pai" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhuma (Pasta Principal)</SelectItem>
                                {availableFolders.map(folder => (
                                    <SelectItem key={folder.id} value={folder.id}>
                                        {folder.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Cor da Categoria</Label>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {colorOptions.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>
                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!name.trim()}>
                            {editingFolder ? 'Salvar Alterações' : 'Criar Pasta'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ConnectionFolderDialog;
