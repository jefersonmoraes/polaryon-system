import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { 
    X,
    FileText, 
    FileCode, 
    Loader2, 
    ExternalLink, 
    Download, 
    Maximize2, 
    Minimize2,
    FileType,
    AlertTriangle,
    Search
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FilePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    fileName: string;
    fileType?: string; // image, pdf, xml, text
}

export const FilePreviewModal = ({ 
    isOpen, 
    onClose, 
    fileUrl, 
    fileName, 
    fileType: initialFileType 
}: FilePreviewModalProps) => {
    const [fileType, setFileType] = useState<string>(initialFileType || '');
    const [isLoading, setIsLoading] = useState(true);
    const [xmlData, setXmlData] = useState<any>(null);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [hasError, setHasError] = useState(false);

    // Get Proxy URL if external (PNCP / External sites)
    const getSafeUrl = (url: string) => {
        if (!url) return '';
        // If external, use our safe proxy to bypass CORS/X-Frame-Options
        if (url.startsWith('http') && !url.includes('localhost') && !url.includes('polaryon.com.br')) {
            return `/api/kanban/file-proxy?url=${encodeURIComponent(url)}`;
        }
        return url;
    };

    // Initial normalization for pure Base64 strings (common in legacy Polaryon data)
    const normalizedFileUrl = React.useMemo(() => {
        if (fileUrl && !fileUrl.startsWith('http') && !fileUrl.startsWith('data:') && !fileUrl.startsWith('blob:')) {
            if (fileName.toLowerCase().endsWith('.pdf')) {
                return `data:application/pdf;base64,${fileUrl}`;
            } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => fileName.toLowerCase().endsWith(ext))) {
                const ext = fileName.split('.').pop()?.toLowerCase();
                return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${fileUrl}`;
            }
        }
        return fileUrl;
    }, [fileUrl, fileName]);

    useEffect(() => {
        if (!isOpen) {
            if (blobUrl && blobUrl.startsWith('blob:')) {
                URL.revokeObjectURL(blobUrl);
            }
            setBlobUrl(null);
            return;
        }
        
        setIsLoading(true);
        setHasError(false);
        setXmlData(null);
        setTextContent(null);
        setZoom(1);

        // Detect file type
        let type = initialFileType || '';
        if (!type) {
            const lowerUrl = normalizedFileUrl?.toLowerCase() || '';
            const lowerName = fileName.toLowerCase();
            if (lowerUrl.startsWith('data:application/pdf') || lowerName.endsWith('.pdf')) type = 'pdf';
            else if (lowerUrl.startsWith('data:image') || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].some(ext => lowerName.endsWith(ext))) type = 'image';
            else if (lowerName.endsWith('.xml')) type = 'xml';
            else if (['.txt', '.csv', '.log', '.sped', '.sintegra'].some(ext => lowerName.endsWith(ext))) type = 'text';
        }
        setFileType(type);

        const setupPreview = async () => {
            try {
                if (normalizedFileUrl.startsWith('data:')) {
                    const response = await fetch(normalizedFileUrl);
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    setBlobUrl(url);
                    setIsLoading(false);
                } else if (normalizedFileUrl.startsWith('http')) {
                    // Start directly with proxy URL for all external http files to ensure display
                    const proxyUrl = getSafeUrl(normalizedFileUrl);
                    setBlobUrl(proxyUrl);
                    setIsLoading(false);
                } else {
                    setBlobUrl(normalizedFileUrl);
                    setIsLoading(false);
                }

                if (type === 'xml') await fetchXml();
                else if (type === 'text') await fetchText();
            } catch (e) {
                console.error("Setup preview error:", e);
                setHasError(true);
                setIsLoading(false);
            }
        };

        setupPreview();
    }, [isOpen, normalizedFileUrl, fileName, initialFileType]);

    const fetchXml = async () => {
        try {
            const res = await fetch(getSafeUrl(normalizedFileUrl));
            const text = await res.text();
            setIsLoading(false);
        } catch (e) { setHasError(true); setIsLoading(false); }
    };

    const fetchText = async () => {
        try {
            const res = await fetch(getSafeUrl(normalizedFileUrl));
            const text = await res.text();
            setTextContent(text);
        } catch (e) { setHasError(true); }
        finally { setIsLoading(false); }
    };

    const triggerAction = (actionType: 'download' | 'open') => {
        const url = blobUrl || getSafeUrl(normalizedFileUrl);
        const link = document.createElement('a');
        link.href = url;
        if (actionType === 'download') {
            link.download = fileName;
        } else {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 border-border bg-background shadow-2xl overflow-hidden">
                <DialogHeader className="p-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            {fileType === 'pdf' ? <FileText className="h-5 w-5" /> : <FileType className="h-5 w-5" />}
                        </div>
                        <div className="flex flex-col">
                            <DialogTitle className="text-sm font-black truncate max-w-[300px]">
                                {fileName}
                            </DialogTitle>
                            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">
                                {fileType || 'Doc'} • Seguro Polaryon
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mr-8">
                        <button 
                            onClick={() => triggerAction('open')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs font-black hover:bg-secondary/80 transition-all border border-border/50"
                            title="Abrir em Nova Aba"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Nova Aba</span>
                        </button>
                        <button 
                            onClick={() => triggerAction('download')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-black hover:bg-primary/90 transition-all shadow-lg"
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Baixar</span>
                        </button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto bg-muted/5 relative flex flex-col items-center justify-center min-h-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Processando via Proxy Polaryon...</p>
                        </div>
                    ) : hasError ? (
                        <div className="flex flex-col items-center gap-5 p-12 text-center bg-card border border-border rounded-2xl shadow-2xl animate-in zoom-in duration-300">
                            <div className="p-4 bg-yellow-500/10 rounded-full">
                                <AlertTriangle className="h-12 w-12 text-yellow-500" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-black uppercase tracking-tighter">Acesso Restrito</h3>
                                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                                    O servidor de origem (ex: PNCP) impediu a exibição direta. Clique abaixo para abrir o documento em seu estado original.
                                </p>
                            </div>
                            <button 
                                onClick={() => triggerAction('open')}
                                className="px-8 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg"
                            >
                                ABRIR LINK EXTERNO
                            </button>
                        </div>
                    ) : (
                        <>
                            {fileType === 'pdf' && (
                                <div className="w-full h-full relative">
                                    <iframe 
                                        src={blobUrl || undefined} 
                                        className="w-full h-full border-none bg-white scale-100"
                                        title={fileName}
                                        onLoad={() => setIsLoading(false)}
                                    />
                                </div>
                            )}

                            {fileType === 'image' && (
                                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                    <div className="relative group overflow-hidden rounded-xl shadow-2xl bg-white border border-border">
                                        <img 
                                            src={blobUrl || normalizedFileUrl} 
                                            alt={fileName} 
                                            className="max-w-full max-h-[70vh] object-contain shadow-xl"
                                            style={{ transform: `scale(${zoom})` }}
                                        />
                                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => setZoom(prev => Math.min(prev + 0.5, 3))}
                                                className="p-2 bg-black/60 text-white rounded-full hover:bg-black"
                                            >
                                                <Maximize2 className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={() => setZoom(prev => Math.max(prev - 0.5, 0.5))}
                                                className="p-2 bg-black/60 text-white rounded-full hover:bg-black"
                                            >
                                                <Minimize2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="mt-4 text-[10px] text-muted-foreground font-black italic uppercase tracking-widest">
                                        Modo Visualização Profissional Polaryon
                                    </p>
                                </div>
                            )}

                            {(fileType === 'xml' || fileType === 'text') && (
                                <div className="w-full h-full p-8 font-mono text-[12px] bg-card overflow-auto whitespace-pre-wrap select-text custom-scrollbar">
                                    {textContent || "Visualização bruta carregada para análise."}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
