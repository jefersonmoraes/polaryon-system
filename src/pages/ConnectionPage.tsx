import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Star, ExternalLink, MoreVertical, Trash2, Edit2, FolderPlus, Folder, Filter, Hash } from 'lucide-react';
import { useConnectionStore, ConnectionLink, ConnectionFolder } from '@/store/connection-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConnectionFolderDialog from '@/components/connection/ConnectionFolderDialog';
import ConnectionLinkDialog from '@/components/connection/ConnectionLinkDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const ConnectionPage = () => {
    const { folders, isLoading, fetchFolders, deleteFolder, deleteLink, toggleFavorite } = useConnectionStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFolderId, setSelectedFolderId] = useState<string | 'all' | 'favorites'>('all');
    
    // Dialog states
    const [folderDialogOpen, setFolderDialogOpen] = useState(false);
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState<ConnectionFolder | null>(null);
    const [editingLink, setEditingLink] = useState<ConnectionLink | null>(null);

    useEffect(() => {
        fetchFolders();
    }, [fetchFolders]);

    // Derived data
    const allLinks = useMemo(() => {
        return folders.flatMap(f => f.links.map(l => ({ ...l, folderName: f.name, folderColor: f.color })));
    }, [folders]);

    const filteredLinks = useMemo(() => {
        let result = allLinks;

        if (selectedFolderId === 'favorites') {
            result = result.filter(l => l.isFavorite);
        } else if (selectedFolderId !== 'all') {
            result = result.filter(l => l.folderId === selectedFolderId);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(l => 
                l.title.toLowerCase().includes(query) || 
                (l.description && l.description.toLowerCase().includes(query)) ||
                l.url.toLowerCase().includes(query)
            );
        }

        return result;
    }, [allLinks, selectedFolderId, searchQuery]);

    const getFavicon = (url: string) => {
        try {
            const hostname = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
        } catch (e) {
            return `https://www.google.com/s2/favicons?domain=google.com&sz=64`;
        }
    };

    const handleEditFolder = (folder: ConnectionFolder) => {
        setEditingFolder(folder);
        setFolderDialogOpen(true);
    };

    const handleEditLink = (link: ConnectionLink) => {
        setEditingLink(link);
        setLinkDialogOpen(true);
    };

    const handleAddLink = () => {
        setEditingLink(null);
        setLinkDialogOpen(true);
    };

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="p-4 md:p-6 border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                             CONEXÃO
                            <Badge variant="outline" className="ml-2 bg-primary/5 text-primary border-primary/20 text-[10px] uppercase">Links Úteis</Badge>
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">Gerencie seus atalhos e ferramentas favoritas em um só lugar.</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button onClick={() => { setEditingFolder(null); setFolderDialogOpen(true); }} variant="outline" size="sm" className="gap-2">
                            <FolderPlus className="h-4 w-4" />
                            <span className="hidden sm:inline">Nova Pasta</span>
                        </Button>
                        <Button onClick={handleAddLink} size="sm" className="gap-2 shadow-lg shadow-primary/20">
                            <Plus className="h-4 w-4" />
                            <span>Novo Link</span>
                        </Button>
                    </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Pesquisar links por nome, descrição ou URL..."
                            className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary/30"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <div className="w-64 border-r border-border/50 hidden lg:flex flex-col bg-muted/20 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-2">Categorias</h3>
                    <button
                        onClick={() => setSelectedFolderId('all')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${selectedFolderId === 'all' ? 'bg-primary text-white font-bold shadow-md shadow-primary/20' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}
                    >
                        <Hash className="h-4 w-4" /> Todos os Links
                    </button>
                    <button
                        onClick={() => setSelectedFolderId('favorites')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${selectedFolderId === 'favorites' ? 'bg-amber-500 text-white font-bold shadow-md shadow-amber-500/20' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}
                    >
                        <Star className="h-4 w-4" /> Favoritos
                    </button>

                    <div className="pt-4 space-y-1">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-2 flex items-center justify-between">
                            Minhas Pastas
                        </h3>
                        {folders.map(folder => (
                            <div key={folder.id} className="group relative">
                                <button
                                    onClick={() => setSelectedFolderId(folder.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all border-l-4 ${selectedFolderId === folder.id ? 'bg-card text-foreground font-bold border-l-primary shadow-sm' : 'hover:bg-accent text-muted-foreground hover:text-foreground border-l-transparent'}`}
                                >
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: folder.color || '#3b82f6' }} />
                                    <span className="truncate">{folder.name}</span>
                                    <span className="ml-auto text-[10px] bg-muted px-1.5 rounded-full font-normal group-hover:bg-accent-foreground/10">{folder.links.length}</span>
                                </button>
                                
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="p-1 hover:bg-muted rounded"><MoreVertical className="h-3 w-3" /></button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEditFolder(folder)} className="gap-2">
                                                <Edit2 className="h-3 w-3" /> Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => deleteFolder(folder.id)} className="text-destructive gap-2 focus:text-destructive">
                                                <Trash2 className="h-3 w-3" /> Excluir
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Grid Component */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-accent/5">
                    {/* Mobile/Tablet Category Select */}
                    <div className="lg:hidden mb-6 flex flex-wrap gap-2">
                         <Button variant={selectedFolderId === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedFolderId('all')} className="rounded-full h-8 text-xs">Todos</Button>
                         <Button variant={selectedFolderId === 'favorites' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedFolderId('favorites')} className="rounded-full h-8 text-xs gap-1"><Star className="h-3 w-3" /> Favoritos</Button>
                         {folders.map(f => (
                             <Button 
                                key={f.id} 
                                variant={selectedFolderId === f.id ? 'default' : 'outline'} 
                                size="sm" 
                                onClick={() => setSelectedFolderId(f.id)} 
                                className="rounded-full h-8 text-xs"
                                style={selectedFolderId === f.id ? { backgroundColor: f.color || undefined } : { borderColor: f.color || undefined }}
                            >
                                {f.name}
                            </Button>
                         ))}
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm font-medium">Carregando links...</p>
                        </div>
                    ) : filteredLinks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-96 text-center animate-in zoom-in duration-300">
                             <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                                <Search className="h-10 w-10 text-muted-foreground/30" />
                             </div>
                             <h3 className="text-lg font-bold text-foreground">Nenhum link encontrado</h3>
                             <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
                                {searchQuery ? 'Não encontramos nada com esses termos. Tente outra busca.' : 'Esta categoria está vazia. Comece adicionando seu primeiro link agora mesmo!'}
                             </p>
                             {!searchQuery && (
                                <Button onClick={handleAddLink} variant="link" className="mt-2 text-primary">Adicionar Novo Link</Button>
                             )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                            {filteredLinks.map((link) => (
                                <div
                                    key={link.id}
                                    className="group relative bg-card border border-border/50 hover:border-primary/50 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 flex flex-col h-full"
                                >
                                    {/* Card Header with folder color strip */}
                                    <div className="h-1.5 w-full" style={{ backgroundColor: link.folderColor || '#3b82f6' }} />
                                    
                                    <div className="p-5 flex flex-col h-full">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center overflow-hidden border border-border/20 shadow-inner group-hover:scale-110 transition-transform duration-300">
                                                <img 
                                                    src={getFavicon(link.url)} 
                                                    alt={link.title} 
                                                    className="w-8 h-8 object-contain"
                                                    onError={(e) => { (e.target as any).src = 'https://www.google.com/s2/favicons?domain=google.com&sz=64' }}
                                                />
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => toggleFavorite(link)} 
                                                    className={`p-1.5 rounded-full transition-colors ${link.isFavorite ? 'text-amber-500 hover:bg-amber-500/10' : 'text-muted-foreground hover:bg-muted'}`}
                                                    title={link.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                                >
                                                    <Star className={`h-4 w-4 ${link.isFavorite ? 'fill-current' : ''}`} />
                                                </button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="p-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleEditLink(link)} className="gap-2">
                                                            <Edit2 className="h-4 w-4" /> Editar Link
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => deleteLink(link.id)} className="text-destructive gap-2 focus:text-destructive">
                                                            <Trash2 className="h-4 w-4" /> Excluir
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">{link.title}</h4>
                                                {link.isFavorite && <Star className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mb-3 line-clamp-1 opacity-60 font-medium">
                                                {new URL(link.url).hostname}
                                            </p>
                                            <p className="text-xs text-muted-foreground line-clamp-3 min-h-[3rem]">
                                                {link.description || 'Sem descrição definida para este atalho.'}
                                            </p>
                                        </div>

                                        <div className="mt-5 flex items-center justify-between gap-3">
                                            <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider py-0 px-2 h-5 bg-muted/50 border-transparent">
                                                {link.folderName}
                                            </Badge>
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 active:scale-95 ml-auto"
                                            >
                                                Acessar
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {/* Dialogs */}
            <ConnectionFolderDialog 
                open={folderDialogOpen} 
                onOpenChange={setFolderDialogOpen} 
                editingFolder={editingFolder}
            />
            <ConnectionLinkDialog 
                open={linkDialogOpen} 
                onOpenChange={setLinkDialogOpen} 
                editingLink={editingLink}
                defaultFolderId={selectedFolderId !== 'all' && selectedFolderId !== 'favorites' ? selectedFolderId : undefined}
            />
        </div>
    );
};

export default ConnectionPage;
