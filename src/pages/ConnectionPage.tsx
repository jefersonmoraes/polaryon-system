import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Star, ExternalLink, MoreVertical, Trash2, Edit2, Folder, RotateCcw, XCircle } from 'lucide-react';
import { useConnectionStore, ConnectionLink, ConnectionFolder } from '@/store/connection-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConnectionFolderDialog from '@/components/connection/ConnectionFolderDialog';
import ConnectionLinkDialog from '@/components/connection/ConnectionLinkDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';

const ConnectionPage = () => {
    const { 
        folders, trashedFolders, isLoading, fetchFolders, 
        trashLink, restoreLink, permanentDeleteLink,
        toggleFavorite 
    } = useConnectionStore();

    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    
    // Sync view mode and folder from URL
    const viewMode = (searchParams.get('view') as 'active' | 'trash') || 'active';
    const selectedFolderId = searchParams.get('folder') || (viewMode === 'active' ? 'favorites' : null);
    
    // Dialog states
    const [folderDialogOpen, setFolderDialogOpen] = useState(false);
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState<ConnectionFolder | null>(null);
    const [editingLink, setEditingLink] = useState<ConnectionLink | null>(null);

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

        return base;
    }, [activeLinks, trashedLinks, viewMode, selectedFolderId, searchQuery]);

    const getFavicon = (url: string) => {
        try {
            const hostname = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
        } catch (e) {
            return `https://www.google.com/s2/favicons?domain=google.com&sz=128`;
        }
    };

    const handleEditLink = (link: ConnectionLink) => {
        setEditingLink(link);
        setLinkDialogOpen(true);
    };

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
                            onClick={() => { setEditingFolder(null); setFolderDialogOpen(true); }}
                            className="h-12 px-6 rounded-2xl gap-2 font-bold"
                        >
                            <Plus className="h-5 w-5" />
                            <span className="hidden sm:inline">Nova Pasta</span>
                        </Button>
                        <Button 
                            onClick={() => { setEditingLink(null); setLinkDialogOpen(true); }} 
                            className="h-12 px-6 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold shadow-xl shadow-primary/25 gap-2 transition-all active:scale-95"
                        >
                            <Plus className="h-5 w-5" />
                            <span className="hidden sm:inline">Adicionar Link</span>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-accent/5">
                <div className="max-w-[1600px] mx-auto space-y-8">
                    {/* Breadcrumb / Title area */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-2xl ${viewMode === 'trash' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                                {viewMode === 'trash' ? <Trash2 className="h-6 w-6" /> : selectedFolderId === 'favorites' ? <Star className="h-6 w-6 fill-primary" /> : <Folder className="h-6 w-6" />}
                            </div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                                    {viewMode === 'trash' ? 'Lixeira' : selectedFolderId === 'favorites' ? 'Meus Favoritos' : folders.find(f => f.id === selectedFolderId)?.name || 'Todos os Links'}
                                </h1>
                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    {displayLinks.length} {displayLinks.length === 1 ? 'item' : 'itens'} {viewMode === 'trash' ? 'na lixeira' : 'encontrados'}
                                    {searchQuery && <Badge variant="secondary" className="font-normal">Filtro: {searchQuery}</Badge>}
                                </p>
                            </div>
                        </div>

                        {viewMode === 'trash' && displayLinks.length > 0 && (
                            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 rounded-xl" onClick={() => {}}>
                                <Trash2 className="h-4 w-4" /> Esvaziar Lixeira
                            </Button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-3">
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full" />
                            <p className="text-sm font-bold text-muted-foreground">Sincronizando conexões...</p>
                        </div>
                    ) : displayLinks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in duration-500">
                             <div className="w-24 h-24 bg-muted/40 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-inner rotate-12 group hover:rotate-0 transition-transform duration-500">
                                <Search className="h-12 w-12 text-muted-foreground/40 group-hover:scale-110 transition-transform" />
                             </div>
                             <h3 className="text-xl font-black text-foreground">Nada por aqui!</h3>
                             <p className="text-muted-foreground text-base max-w-sm mx-auto mt-2 leading-relaxed">
                                {searchQuery ? 'Não encontramos links com esses termos na busca.' : 'Esta seção está pronta para receber seus primeiros atalhos estratégicos.'}
                             </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                            <AnimatePresence mode="popLayout">
                                {displayLinks.map((link) => (
                                    <motion.div
                                        layout
                                        key={link.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="group relative bg-card border border-border/50 hover:border-primary/40 rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 flex flex-col gap-3 overflow-hidden h-[185px]"
                                    >
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                        
                                        <div className="flex items-start justify-between relative z-10">
                                            <div className="w-12 h-12 rounded-xl bg-muted/30 p-2 border border-border/40 shadow-sm group-hover:scale-105 transition-transform duration-500">
                                                <img 
                                                    src={getFavicon(link.url)} 
                                                    alt={link.title} 
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => { (e.target as any).src = 'https://www.google.com/s2/favicons?domain=google.com&sz=128' }}
                                                />
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={() => toggleFavorite(link)} 
                                                    className={`p-1.5 rounded-lg transition-all duration-300 ${link.isFavorite ? 'bg-amber-500/10 text-amber-500' : 'text-muted-foreground/30 hover:bg-muted hover:text-foreground'}`}
                                                >
                                                    <Star className={`h-4 w-4 ${link.isFavorite ? 'fill-current' : ''}`} />
                                                </button>
                                                
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="p-1.5 rounded-lg text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-all">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl">
                                                        {viewMode === 'active' ? (
                                                            <>
                                                                <DropdownMenuItem onClick={() => handleEditLink(link)} className="gap-2 p-2 rounded-lg cursor-pointer">
                                                                    <Edit2 className="h-3.5 w-3.5" /> Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => trashLink(link.id)} className="text-destructive gap-2 p-2 rounded-lg cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                                                                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                                                                </DropdownMenuItem>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <DropdownMenuItem onClick={() => restoreLink(link.id)} className="gap-2 p-2 rounded-lg cursor-pointer text-emerald-500 focus:text-emerald-500">
                                                                    <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => permanentDeleteLink(link.id)} className="text-destructive gap-2 p-2 rounded-lg cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                                                                    <XCircle className="h-3.5 w-3.5" /> Excluir permanentemente
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-1 relative z-10 min-w-0">
                                            <h4 className="text-base font-black tracking-tight text-foreground/90 line-clamp-1 group-hover:text-primary transition-colors">{link.title}</h4>
                                            <p className="text-[10px] text-muted-foreground/60 font-bold tracking-tight uppercase line-clamp-1">{(new URL(link.url)).hostname.replace('www.', '')}</p>
                                        </div>

                                        <div className="relative z-10 mt-auto">
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-[11px] font-black transition-all duration-300 shadow-sm border border-primary/20 hover:border-transparent group-hover:shadow-lg group-hover:shadow-primary/25"
                                            >
                                                ACESSAR LINK
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
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
                defaultFolderId={selectedFolderId !== 'favorites' ? selectedFolderId || undefined : (folders.length > 0 ? folders[0].id : undefined)}
            />
        </div>
    );
};

export default ConnectionPage;
