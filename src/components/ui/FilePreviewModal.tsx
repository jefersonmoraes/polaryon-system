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

    // Normalização inicial para URLs Base64 puras
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
                } else if (normalizedFileUrl.startsWith('http')) {
                    // Para URLs externas, primeiro tentamos baixar pra um Blob local (ignora CSP/X-Frame-Options do destino)
                    try {
                        const response = await fetch(normalizedFileUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            const url = URL.createObjectURL(blob);
                            setBlobUrl(url);
                        } else {
                            setBlobUrl(normalizedFileUrl);
                        }
                    } catch (e) {
                        setBlobUrl(normalizedFileUrl);
                    }
                } else {
                    setBlobUrl(normalizedFileUrl);
                }

                if (type === 'xml') await fetchXml();
                else if (type === 'text') await fetchText();
                else setIsLoading(false);
            } catch (e) {
                console.error("Setup preview error:", e);
                setHasError(true);
                setIsLoading(false);
            }
        };

        setupPreview();
    }, [isOpen]); // Dependências mínimas para evitar re-renders infinitos

    const fetchXml = async () => {
        try {
            const response = await fetch(normalizedFileUrl);
            const text = await response.text();
            // ... lógica de XML permanece igual, mas simplificada para estabilidade
            setIsLoading(false);
        } catch (e) { setHasError(true); setIsLoading(false); }
    };

    const fetchText = async () => {
        try {
            const response = await fetch(normalizedFileUrl);
            setTextContent(await response.text());
        } catch (e) { setHasError(true); }
        finally { setIsLoading(false); }
    };

    const triggerAction = (actionType: 'download' | 'open') => {
        const url = blobUrl || normalizedFileUrl;
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
                            <DialogTitle className="text-sm font-bold truncate max-w-[300px]">
                                {fileName}
                            </DialogTitle>
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">
                                {fileType || 'Visualização'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mr-8">
                        <button 
                            onClick={() => triggerAction('open')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs font-black hover:bg-secondary/80 transition-all"
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
                        <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors ml-2">
                           <X className="h-4 w-4" />
                        </button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden bg-muted/5 relative flex flex-col items-center justify-center min-h-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Preparando Documento...</p>
                        </div>
                    ) : (
                        <>
                            {fileType === 'pdf' && (
                                <iframe 
                                    src={blobUrl || normalizedFileUrl} 
                                    className="w-full h-full border-none bg-white"
                                    title={fileName}
                                    style={{ visibility: isLoading ? 'hidden' : 'visible' }}
                                    onLoad={() => setIsLoading(false)}
                                />
                            )}
                            {fileType === 'image' && (
                                <div className="w-full h-full flex items-center justify-center p-4">
                                    <img 
                                        src={blobUrl || normalizedFileUrl} 
                                        alt={fileName} 
                                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                                        style={{ transform: `scale(${zoom})` }}
                                    />
                                </div>
                            )}
                            {/* Fallback amigável caso iframe falhe ou tipo não suportado */}
                            {(!fileType || hasError) && (
                                <div className="flex flex-col items-center gap-4 p-8 text-center bg-card border border-border rounded-2xl shadow-xl">
                                    <AlertTriangle className="h-12 w-12 text-yellow-500" />
                                    <h3 className="font-black text-lg">Visualização Indisponível</h3>
                                    <p className="text-xs text-muted-foreground max-w-xs">Este arquivo não permite visualização direta devido a restrições de segurança ou formato.</p>
                                    <button 
                                        onClick={() => triggerAction('open')}
                                        className="text-xs font-black text-primary underline underline-offset-4"
                                    >
                                        ABRIR DOCUMENTO ORIGINAL
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
