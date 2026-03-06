import { useState } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { Plus, LayoutGrid, Search, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const KunbunPage = () => {
    const { folders, boards, addFolder } = useKanbanStore();
    const navigate = useNavigate();
    const [addingFolder, setAddingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderColor, setNewFolderColor] = useState('#3b82f6'); // Default primary blue
    const [newFolderSideImage, setNewFolderSideImage] = useState<string | undefined>();
    const [searchQuery, setSearchQuery] = useState('');

    const activeFolders = folders.filter(f => !f.archived && !f.trashed);
    const activeBoards = boards.filter(b => !b.archived && !b.trashed);

    const filteredFolders = activeFolders.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateFolder = () => {
        if (newFolderName.trim()) {
            addFolder(newFolderName.trim(), newFolderColor, newFolderSideImage);
            setNewFolderName('');
            setNewFolderColor('#3b82f6');
            setNewFolderSideImage(undefined);
            setAddingFolder(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => setNewFolderSideImage(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden animate-in fade-in duration-300">
            <header className="shrink-0 px-6 py-5 border-b border-border bg-card">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <LayoutGrid className="h-6 w-6 text-primary" />
                            KUNBUN
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Gerencie suas pastas e quadros de projeto de forma unificada.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar pasta..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            />
                        </div>

                        <button
                            onClick={() => setAddingFolder(true)}
                            className="shrink-0 flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
                        >
                            <Plus className="h-4 w-4" />
                            Nova Pasta
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
                {addingFolder && (
                    <div className="mb-8 p-5 bg-card border border-border rounded-lg shadow-sm animate-in slide-in-from-top-4 fade-in duration-300">
                        <h3 className="text-base font-semibold mb-4">Criar Nova Pasta</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nome da Pasta</label>
                                <input
                                    autoFocus
                                    placeholder="Ex: Projetos 2024"
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleCreateFolder();
                                        if (e.key === 'Escape') setAddingFolder(false);
                                    }}
                                    className="w-full bg-background px-3 py-2 rounded-md text-sm border border-border focus:border-primary outline-none transition-colors"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Cor de Identificação</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={newFolderColor}
                                        onChange={e => setNewFolderColor(e.target.value)}
                                        className="w-10 h-10 p-1 bg-background border border-border rounded-md cursor-pointer shrink-0"
                                    />
                                    <div className="flex-1">
                                        <label className="text-xs text-muted-foreground block mb-1">Ou envie uma imagem</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="text-xs text-muted-foreground w-full file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer"
                                            onChange={handleImageUpload}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end mt-6">
                            <button
                                onClick={() => {
                                    setAddingFolder(false);
                                    setNewFolderName('');
                                    setNewFolderSideImage(undefined);
                                }}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateFolder}
                                disabled={!newFolderName.trim()}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Criar
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredFolders.map(folder => {
                        const folderBoards = activeBoards.filter(b => b.folderId === folder.id);

                        return (
                            <div
                                key={folder.id}
                                onClick={() => navigate(`/folder/${folder.id}`)}
                                className="group relative bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col h-[200px]"
                            >
                                <div className="h-2 w-full shrink-0" style={{ backgroundColor: folder.color }} />

                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        {folder.sideImage ? (
                                            <div className="shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border/50">
                                                <img src={folder.sideImage} alt={folder.name} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div
                                                className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-inner"
                                                style={{ backgroundColor: folder.color }}
                                            >
                                                {folder.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="bg-primary/10 text-primary text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-1">
                                            {folderBoards.length} {folderBoards.length === 1 ? 'Quadro' : 'Quadros'}
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-lg text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                        {folder.name}
                                    </h3>

                                    <div className="mt-auto pt-4 flex gap-2 overflow-hidden flex-wrap">
                                        {folderBoards.slice(0, 3).map(board => (
                                            <span key={board.id} className="text-[10px] bg-muted text-muted-foreground px-2 py-1 rounded border border-border/50 truncate max-w-full">
                                                {board.name}
                                            </span>
                                        ))}
                                        {folderBoards.length > 3 && (
                                            <span className="text-[10px] text-muted-foreground px-1 py-1 font-medium">
                                                +{folderBoards.length - 3}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredFolders.length === 0 && !addingFolder && (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <Archive className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-1">Nenhuma pasta encontrada</h3>
                        <p className="text-muted-foreground text-sm max-w-sm">
                            {searchQuery
                                ? 'Não encontramos nenhuma pasta com os termos pesquisados.'
                                : 'Sua área de trabalho está vazia. Comece criando uma nova pasta para organizar seus projetos.'}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default KunbunPage;
