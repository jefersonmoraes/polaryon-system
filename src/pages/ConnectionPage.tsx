import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Star, ExternalLink, MoreVertical, Trash2, Edit2, Folder, RotateCcw, XCircle, ChevronUp, ChevronDown, FolderPlus, FolderOpen } from 'lucide-react';
import { useConnectionStore, ConnectionLink, ConnectionFolder } from '@/store/connection-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConnectionFolderDialog from '@/components/connection/ConnectionFolderDialog';
import ConnectionLinkDialog from '@/components/connection/ConnectionLinkDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';

const ConnectionPage = () => {
    const { 
        folders, trashedFolders, isLoading, fetchFolders, 
        trashLink, restoreLink, permanentDeleteLink,
        toggleFavorite, trashFolder,
        setFolderDialogOpen, setLinkDialogOpen,
        reorderFolders, reorderLinks
    } = useConnectionStore();

    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    
    // Sync view mode and folder from URL
    const viewMode = (searchParams.get('view') as 'active' | 'trash') || 'active';
    const selectedFolderId = searchParams.get('folder') || (viewMode === 'active' ? 'favorites' : null);
    
    useEffect(() => {
        fetchFolders(false);
        fetchFolders(true);
    }, [fetchFolders]);

    // Derived data
    const activeLinks = useMemo(() => {
        return folders.flatMap(f => f.links.map(l => ({ ...l, folderName: f.name, folderColor: f.color })));
    }, [folders]);

    const trashedLinks = useMemo(() => {
        return trashedFolders.flatMap(f => f.links.map(l => ({ ...l, folderName: f.name, folderColor: f.color })));
    }, [trashedFolders]);

    const subfolders = useMemo(() => {
        if (viewMode === 'trash' || selectedFolderId === 'favorites') return [];
        return folders.filter(f => f.parentId === selectedFolderId);
    }, [folders, selectedFolderId, viewMode]);

    const displayLinks = useMemo(() => {
        let base = viewMode === 'active' ? activeLinks : trashedLinks;

        if (viewMode === 'active') {
            if (selectedFolderId === 'favorites') {
                base = base.filter(l => l.isFavorite);
            } else if (selectedFolderId) {
                base = base.filter(l => l.folderId === selectedFolderId);
            }
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            base = base.filter(l => 
                l.title.toLowerCase().includes(query) || 
                (l.description && l.description.toLowerCase().includes(query)) ||
                l.url.toLowerCase().includes(query)
            );
        }

        // Favoritos primeiro, depois por nome (alfabético)
        return [...base].sort((a, b) => {
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;
            return a.title.localeCompare(b.title);
        });
    }, [activeLinks, trashedLinks, viewMode, selectedFolderId, searchQuery]);

    const groupedFavorites = useMemo(() => {
        if (selectedFolderId !== 'favorites' || viewMode !== 'active') return null;
        
        const groups: { [folderId: string]: { id: string; name: string; color: string; links: any[] } } = {};
        
        displayLinks.forEach(link => {
            const folderId = link.folderId || 'uncategorized';
            if (!groups[folderId]) {
                groups[folderId] = {
                    id: folderId,
                    name: link.folderName || 'Sem Pasta',
                    color: link.folderColor || '#94a3b8',
                    links: []
                };
            }
            groups[folderId].links.push(link);
        });
        
        // Sort groups by name
        return Object.values(groups).sort((a, b) => {
            if (a.id === 'uncategorized') return 1;
            if (b.id === 'uncategorized') return -1;
            return a.name.localeCompare(b.name);
        });
    }, [displayLinks, selectedFolderId, viewMode]);

    const getFavicon = (url: string) => {
        try {
            const hostname = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
        } catch (e) {
            return `https://www.google.com/s2/favicons?domain=google.com&sz=128`;
        }
    };

    const handleEditLink = (link: ConnectionLink) => {
        setLinkDialogOpen(true, link);
    };

    const selectedFolderName = useMemo(() => {
        if (selectedFolderId === 'favorites') return 'Meus Favoritos';
        return folders.find(f => f.id === selectedFolderId)?.name || 'Todos os Links';
    }, [folders, selectedFolderId]);

    const RenderLink = ({ link }: { link: ConnectionLink & { folderName?: string, folderColor?: string } }) => (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="group relative bg-card border border-border/50 hover:border-primary/40 rounded-[1.5rem] p-4 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 flex flex-col gap-3 overflow-hidden h-auto lg:min-h-[240px]"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="flex items-start justify-between relative z-10">
                <div className="w-8 h-8 rounded-lg bg-muted/40 p-1.5 border border-border/20 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-all duration-700">
                    <img 
                        src={getFavicon(link.url)} 
                        alt={link.title} 
                        className="w-full h-full object-contain filter drop-shadow-sm"
                        onError={(e) => { (e.target as any).src = 'https://www.google.com/s2/favicons?domain=google.com&sz=128' }}
                    />
                </div>
                            
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button 
                        onClick={() => toggleFavorite(link)} 
                        className={`p-2 rounded-xl transition-all duration-500 shadow-sm ${link.isFavorite ? 'bg-amber-500/20 text-amber-500' : 'bg-background/80 backdrop-blur-sm text-muted-foreground/40 hover:text-amber-500'}`}
                    >
                        <Star className={`h-4 w-4 ${link.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="p-2 rounded-xl bg-background/80 backdrop-blur-sm text-muted-foreground/40 hover:text-foreground transition-all shadow-sm">
                                <MoreVertical className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 p-2 rounded-2xl shadow-2xl border-border/40">
                            {viewMode === 'active' ? (
                                <>
                                    <DropdownMenuItem onClick={() => handleEditLink(link)} className="gap-3 p-3 rounded-xl cursor-pointer font-bold text-sm">
                                        <Edit2 className="h-4 w-4 text-primary" /> Editar Link
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => trashLink(link.id)} className="text-destructive gap-3 p-3 rounded-xl cursor-pointer font-bold text-sm focus:bg-destructive/10 focus:text-destructive">
                                        <Trash2 className="h-4 w-4" /> Mover p/ Lixeira
                                    </DropdownMenuItem>
                                </>
                            ) : (
                                <>
                                    <DropdownMenuItem onClick={() => restoreLink(link.id)} className="gap-3 p-3 rounded-xl cursor-pointer text-emerald-500 focus:text-emerald-500 font-bold text-sm">
                                        <RotateCcw className="h-4 w-4" /> Restaurar Link
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => permanentDeleteLink(link.id)} className="text-destructive gap-3 p-3 rounded-xl cursor-pointer focus:bg-destructive/10 focus:text-destructive font-bold text-sm">
                                        <XCircle className="h-4 w-4" /> Excluir para sempre
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
    
            <div className="flex-1 space-y-1 relative z-10 min-w-0">
                <h4 className="text-lg font-black tracking-tight text-foreground/90 line-clamp-1 group-hover:text-primary transition-colors duration-500">{link.title}</h4>
                <p className="text-[11px] text-muted-foreground/60 font-black tracking-widest uppercase truncate">
                    {(() => {
                        try {
                            return new URL(link.url).hostname.replace('www.', '');
                        } catch (e) {
                            return link.url;
                        }
                    })()}
                </p>
                {link.description && <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed mt-2 opacity-80">{link.description}</p>}
            </div>
    
            <div className="relative z-10 mt-auto pt-2">
                <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-12 flex items-center justify-center gap-3 rounded-2xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-[12px] font-black transition-all duration-500 shadow-sm border border-primary/20 hover:border-transparent group-hover:shadow-xl group-hover:shadow-primary/30"
                >
                    ABRIR CONEXÃO
                    <ExternalLink className="h-4 w-4" />
                </a>
            </div>
        </motion.div>
    );

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in duration-500 overflow-hidden">
            {/* Header com Busca e Ações */}
            <header className="p-6 border-b border-border/40 bg-background/50 backdrop-blur-md sticky top-0 z-10">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-6">
                    <div className="flex-1 max-w-2xl relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Pesquisar em suas conexões..."
                            className="pl-12 h-12 bg-muted/20 border-border/50 rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary/50 text-base"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => setFolderDialogOpen(true, { id: '', name: '', color: '#3b82f6', parentId: selectedFolderId && selectedFolderId !== 'favorites' ? selectedFolderId : null, links: [], createdAt: '', updatedAt: '', order: 0 } as any)}
                            className="h-12 px-6 rounded-2xl gap-2 font-bold shadow-sm"
                        >
                            <Plus className="h-5 w-5" />
                            <span className="hidden sm:inline">{selectedFolderId && selectedFolderId !== 'favorites' ? 'Nova Subpasta' : 'Nova Pasta'}</span>
                        </Button>
                        <Button 
                            onClick={() => setLinkDialogOpen(true)} 
                            className="h-12 px-6 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold shadow-xl shadow-primary/25 gap-2 transition-all active:scale-95"
                        >
                            <Plus className="h-5 w-5" />
                            <span className="hidden sm:inline">Adicionar Link</span>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-accent/5">
                <div className="max-w-[1600px] mx-auto space-y-10">
                    {/* Breadcrumb / Title area */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-4 rounded-[2rem] shadow-lg ${viewMode === 'trash' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                                {viewMode === 'trash' ? <Trash2 className="h-7 w-7" /> : selectedFolderId === 'favorites' ? <Star className="h-7 w-7 fill-primary" /> : <FolderOpen className="h-7 w-7" />}
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                                    {viewMode === 'trash' ? 'Lixeira' : selectedFolderName}
                                </h1>
                                <p className="text-sm font-bold text-muted-foreground/70 flex items-center gap-2">
                                    {displayLinks.length + subfolders.length} itens no total
                                    {searchQuery && <Badge variant="secondary" className="font-bold rounded-lg px-3 py-1 bg-primary/10 text-primary border-none">Busca: {searchQuery}</Badge>}
                                </p>
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-96 gap-4">
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full shadow-xl" />
                            <p className="text-sm font-black text-muted-foreground animate-pulse">SINCRONIZANDO SISTEMA...</p>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {/* SEÇÃO DE PASTAS */}
                            {subfolders.length > 0 && (
                                <section className="space-y-6 animate-in slide-in-from-bottom duration-500">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-sm font-black text-muted-foreground/60 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Folder className="h-4 w-4" /> Pastas ({subfolders.length})
                                        </h2>
                                        <div className="h-px flex-1 bg-border/40 mx-6" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        <AnimatePresence mode="popLayout">
                                            {[...subfolders].sort((a, b) => a.name.localeCompare(b.name)).map((folder, idx) => (
                                                <motion.div
                                                    layout
                                                    key={folder.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    className="group relative"
                                                >
                                                    <RouterLink
                                                        to={`/conexao?folder=${folder.id}`}
                                                        className="flex items-center gap-3 p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/40 hover:bg-accent/5 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-primary/5"
                                                    >
                                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                                                            <Folder className="h-5 w-5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-sm truncate">{folder.name}</p>
                                                            <p className="text-[10px] text-muted-foreground/60 font-medium">
                                                                {folder.links.length} links
                                                            </p>
                                                        </div>
                                                    </RouterLink>

                                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="secondary" size="icon" className="h-7 w-7 rounded-lg bg-background/80 backdrop-blur-sm shadow-sm">
                                                                    <MoreVertical className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                                                <DropdownMenuItem onClick={(e) => { e.preventDefault(); setFolderDialogOpen(true, folder); }} className="gap-2 rounded-lg cursor-pointer">
                                                                    <Edit2 className="h-3.5 w-3.5" /> Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={(e) => { e.preventDefault(); trashFolder(folder.id); }} className="text-destructive gap-2 rounded-lg cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                                                                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO DE LINKS */}
                            <section className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-black text-muted-foreground/60 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Star className="h-4 w-4" /> Links ({displayLinks.length})
                                    </h2>
                                    <div className="h-px flex-1 bg-border/40 mx-6" />
                                </div>
                                {displayLinks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center bg-card/30 border-2 border-dashed border-border/40 rounded-[2.5rem]">
                                         <div className="w-20 h-20 bg-muted/40 rounded-[2rem] flex items-center justify-center mb-6">
                                            <Search className="h-10 w-10 text-muted-foreground/40" />
                                         </div>
                                         <h3 className="text-lg font-black text-foreground">Nenhum link por aqui</h3>
                                         <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1">Crie seu primeiro link clicando no botão "Adicionar Link" acima.</p>
                                    </div>
                                ) : groupedFavorites ? (
                                    <div className="space-y-12">
                                        {groupedFavorites.map((group) => (
                                            <div key={group.id} className="space-y-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                                                        <Folder className="h-4 w-4" />
                                                    </div>
                                                    <h3 className="font-black text-base tracking-tight text-foreground/80">{group.name}</h3>
                                                    <div className="h-px flex-1 bg-border/40" />
                                                    <Badge variant="secondary" className="font-bold rounded-lg px-3 py-0.5 bg-muted/50 border-none">
                                                        {group.links.length} {group.links.length === 1 ? 'favorito' : 'favoritos'}
                                                    </Badge>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 p-1">
                                                    <AnimatePresence mode="popLayout">
                                                        {group.links.map((link) => (
                                                            <RenderLink key={link.id} link={link} />
                                                        ))}
                                                    </AnimatePresence>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 p-1">
                                        <AnimatePresence mode="popLayout">
                                            {displayLinks.map((link) => (
                                                <RenderLink key={link.id} link={link} />
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </div>
            </div>
 
            {/* Dialogs */}
            <ConnectionFolderDialog />
            <ConnectionLinkDialog 
                defaultFolderId={selectedFolderId !== 'favorites' ? selectedFolderId || undefined : (folders.length > 0 ? folders[0].id : undefined)}
            />
        </div>
    );
};

export default ConnectionPage;
