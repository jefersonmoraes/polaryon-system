import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { 
    X, 
    Download, 
    FileText, 
    ExternalLink, 
    Search, 
    Maximize2, 
    Minimize2,
    FileCode,
    FileType,
    Loader2
} from 'lucide-react';
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

    useEffect(() => {
        if (!isOpen) {
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
                setBlobUrl(null);
            }
            return;
        }
        
        setIsLoading(true);
        setXmlData(null);
        setTextContent(null);
        setZoom(1);

        // Detect file type if not provided
        let type = initialFileType || '';
        
        // Normalização para URLs Base64 puras (comuns em dados legados)
        let normalizedFileUrl = fileUrl;
        if (fileUrl && !fileUrl.startsWith('http') && !fileUrl.startsWith('data:') && !fileUrl.startsWith('blob:')) {
            // Se parece Base64 e o nome é PDF, injeta o cabeçalho
            if (fileName.toLowerCase().endsWith('.pdf')) {
                normalizedFileUrl = `data:application/pdf;base64,${fileUrl}`;
                if (!type) type = 'pdf';
            } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => fileName.toLowerCase().endsWith(ext))) {
                const ext = fileName.split('.').pop()?.toLowerCase();
                normalizedFileUrl = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${fileUrl}`;
                if (!type) type = 'image';
            }
        }

        if (!type) {
            if (normalizedFileUrl.startsWith('data:application/pdf')) type = 'pdf';
            else if (normalizedFileUrl.startsWith('data:image')) type = 'image';
            else if (normalizedFileUrl.startsWith('data:text')) type = 'text';
            else {
                const fileNameLower = fileName.toLowerCase();
                const ext = fileNameLower.split('.').pop();
                if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext || '')) type = 'image';
                else if (ext === 'pdf') type = 'pdf';
                else if (ext === 'xml') type = 'xml';
                else if (['txt', 'csv', 'log', 'sped', 'sintegra'].includes(ext || '')) type = 'text';
            }
        }
        setFileType(type);

        const setupPreview = async () => {
            if (normalizedFileUrl.startsWith('data:')) {
                try {
                    // Para Data URIs de PDF, vamos usar Blob URL para evitar problemas de iframe
                    const parts = normalizedFileUrl.split(';base64,');
                    if (parts.length === 2) {
                        const contentType = parts[0].split(':')[1];
                        const byteCharacters = atob(parts[1].trim()); // Trim para evitar espaços em branco
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: contentType });
                        const url = URL.createObjectURL(blob);
                        setBlobUrl(url);
                    } else {
                        // Fallback simpler fetch
                        const response = await fetch(normalizedFileUrl);
                        const blob = await response.blob();
                        const url = URL.createObjectURL(blob);
                        setBlobUrl(url);
                    }
                } catch (e) {
                    console.error("Failed to create blob from data URI", e);
                    setBlobUrl(null);
                }
            } else {
                setBlobUrl(normalizedFileUrl);
            }

            if (type === 'xml') {
                await fetchXml();
            } else if (type === 'text') {
                await fetchText();
            } else if (type === 'pdf') {
                // PDF loads inside iframe, we hide loader via iframe.onLoad or timeout
                const timer = setTimeout(() => setIsLoading(false), 5000);
                return () => clearTimeout(timer);
            } else {
                // Pequeno delay para garantir que o blob esteja pronto antes de tirar o loader
                setTimeout(() => setIsLoading(false), 200);
            }
        };

        setupPreview();

        return () => {
            if (blobUrl && !fileUrl.startsWith('data:')) {
                // Do not revoke if it's the original external URL
            } else if (blobUrl) {
                // Revoke if it was created locally
                // URL.revokeObjectURL(blobUrl); // We'll do this in the next effect or on close
            }
        };
    }, [isOpen, fileUrl, fileName, initialFileType]);

    const fetchXml = async () => {
        try {
            const response = await fetch(fileUrl);
            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "application/xml");
            
            // Basic NFe/NFSe Extraction (Heuristic)
            const extraction: any = {};
            
            // Try NFe (Product)
            if (xmlDoc.getElementsByTagName('infNFe').length > 0) {
                const node = xmlDoc.getElementsByTagName('infNFe')[0];
                extraction.type = 'NF-e (Produto)';
                extraction.number = xmlDoc.getElementsByTagName('nNF')[0]?.textContent;
                extraction.date = xmlDoc.getElementsByTagName('dhEmi')[0]?.textContent?.split('T')[0];
                extraction.emitente = xmlDoc.getElementsByTagName('xNome')[0]?.textContent;
                extraction.destinatario = xmlDoc.getElementsByTagName('dest')[0]?.getElementsByTagName('xNome')[0]?.textContent;
                extraction.total = xmlDoc.getElementsByTagName('vNF')[0]?.textContent;
                
                const itemsList: any[] = [];
                const dets = xmlDoc.getElementsByTagName('det');
                for (let i = 0; i < dets.length; i++) {
                    const prod = dets[i].getElementsByTagName('prod')[0];
                    itemsList.push({
                        desc: prod.getElementsByTagName('xProd')[0]?.textContent,
                        qtd: prod.getElementsByTagName('qCom')[0]?.textContent,
                        un: prod.getElementsByTagName('uCom')[0]?.textContent,
                        vUn: prod.getElementsByTagName('vUnCom')[0]?.textContent,
                        vTotal: prod.getElementsByTagName('vProd')[0]?.textContent,
                    });
                }
                extraction.items = itemsList;
            } 
            // Try NFSe (Service - Simple format)
            else if (xmlDoc.getElementsByTagName('Nfse').length > 0 || xmlDoc.getElementsByTagName('CompNfse').length > 0) {
                extraction.type = 'NFS-e (Serviço)';
                extraction.number = xmlDoc.getElementsByTagName('Numero')[0]?.textContent;
                extraction.date = xmlDoc.getElementsByTagName('DataEmissao')[0]?.textContent?.split('T')[0];
                extraction.emitente = xmlDoc.getElementsByTagName('RazaoSocial')[0]?.textContent || xmlDoc.getElementsByTagName('xNome')[0]?.textContent;
                extraction.total = xmlDoc.getElementsByTagName('ValorServicos')[0]?.textContent;
                extraction.descr = xmlDoc.getElementsByTagName('Discriminacao')[0]?.textContent;
            }

            setXmlData(extraction);
        } catch (e) {
            console.error("Failed to parse XML", e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchText = async () => {
        try {
            const response = await fetch(fileUrl);
            const text = await response.text();
            setTextContent(text);
        } catch (e) {
            console.error("Failed to fetch text", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName;
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
                            {fileType === 'image' && <FileType className="h-5 w-5" />}
                            {fileType === 'pdf' && <FileText className="h-5 w-5" />}
                            {fileType === 'xml' && <FileCode className="h-5 w-5" />}
                            {fileType === 'text' && <FileText className="h-5 w-5" />}
                        </div>
                        <div className="flex flex-col">
                            <DialogTitle className="text-base font-bold truncate max-w-[300px] md:max-w-md">
                                {fileName}
                            </DialogTitle>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">
                                {fileType || 'Visualização Prévia'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mr-8">
                        <button 
                            onClick={async () => {
                                if (blobUrl) {
                                    window.open(blobUrl, '_blank');
                                } else {
                                    window.open(fileUrl, '_blank');
                                }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs font-bold hover:bg-secondary/80 transition-all border border-border/50"
                            title="Abrir em Nova Aba"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Nova Aba</span>
                        </button>
                        <button 
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Baixar Original</span>
                        </button>
                    </div>
                </DialogHeader>

                <div className={cn(
                    "flex-1 overflow-auto bg-muted/10 relative custom-scrollbar flex flex-col items-center justify-center",
                    fileType !== 'pdf' && "p-4"
                )}>
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                            <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            <p className="text-sm font-medium text-muted-foreground">Carregando visualização...</p>
                        </div>
                    ) : (
                        <>
                            {fileType === 'image' && (
                                <div className="flex flex-col items-center gap-4 w-full h-full justify-center">
                                    <div className="relative group overflow-hidden rounded-lg shadow-xl bg-card border border-border">
                                        <img 
                                            src={blobUrl || fileUrl} 
                                            alt={fileName} 
                                            className="max-w-full max-h-[70vh] object-contain transition-transform duration-200 ease-out cursor-zoom-in"
                                            style={{ transform: `scale(${zoom})` }}
                                            onClick={() => setZoom(prev => prev === 1 ? 2 : 1)}
                                        />
                                        <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => setZoom(prev => Math.min(prev + 0.5, 3))}
                                                className="p-2 bg-black/60 text-white rounded-full hover:bg-black/80 backdrop-blur-sm"
                                            >
                                                <Maximize2 className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={() => setZoom(prev => Math.max(prev - 0.5, 0.5))}
                                                className="p-2 bg-black/60 text-white rounded-full hover:bg-black/80 backdrop-blur-sm"
                                            >
                                                <Minimize2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-medium italic">Role ou clique para dar zoom</p>
                                </div>
                            )}

                            {fileType === 'pdf' && (
                                <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-inner overflow-hidden relative group/pdf">
                                    <iframe 
                                        src={blobUrl && blobUrl.startsWith('blob:') ? blobUrl : (blobUrl ? `${blobUrl}#toolbar=0` : fileUrl)} 
                                        className="w-full h-full border-0"
                                        title={fileName}
                                        onLoad={() => setIsLoading(false)}
                                    />
                                    {/* Link de redundância caso o iframe falhe ou seja bloqueado pelas políticas das empresas */}
                                    <div className="absolute top-2 right-2 px-3 py-1 bg-black/40 backdrop-blur-sm rounded text-[9px] text-white font-bold opacity-0 group-hover/pdf:opacity-100 transition-opacity pointer-events-none">
                                        Modo Visualizador Estendido
                                    </div>
                                </div>
                            )}

                            {fileType === 'xml' && xmlData && (
                                <div className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl p-8 animate-in fade-in zoom-in duration-300">
                                    <div className="flex justify-between items-start border-b-2 border-primary/20 pb-6 mb-6">
                                        <div className="space-y-1">
                                            <h2 className="text-2xl font-black text-primary uppercase tracking-tighter">
                                                {xmlData.type || 'Documento Fiscal'}
                                            </h2>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground font-bold italic">
                                                <span>Nº {xmlData.number || '---'}</span>
                                                <span>•</span>
                                                <span>Emissão: {xmlData.date ? new Date(xmlData.date).toLocaleDateString('pt-BR') : '---'}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Valor Total</p>
                                            <p className="text-3xl font-black text-foreground">
                                                {xmlData.total ? `R$ ${parseFloat(xmlData.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '---'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8 mb-8">
                                        <div className="space-y-1.5 p-4 bg-muted/30 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">Emitente</p>
                                            <p className="font-bold text-sm leading-tight text-foreground uppercase">{xmlData.emitente || 'NÃO IDENTIFICADO'}</p>
                                        </div>
                                        <div className="space-y-1.5 p-4 bg-muted/30 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">Destinatário</p>
                                            <p className="font-bold text-sm leading-tight text-foreground uppercase">{xmlData.destinatario || '---'}</p>
                                        </div>
                                    </div>

                                    {xmlData.items ? (
                                        <div className="border border-border rounded-lg overflow-hidden">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-muted capitalize font-black text-muted-foreground tracking-wider border-b border-border">
                                                    <tr>
                                                        <th className="px-4 py-3">Descrição do Item</th>
                                                        <th className="px-4 py-3 text-center">Un</th>
                                                        <th className="px-4 py-3 text-center">Qtde</th>
                                                        <th className="px-4 py-3 text-right">Vlr Unit</th>
                                                        <th className="px-4 py-3 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/50">
                                                    {xmlData.items.map((item: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                                            <td className="px-4 py-3 font-bold text-foreground/80 uppercase">{item.desc}</td>
                                                            <td className="px-4 py-3 text-center font-medium">{item.un}</td>
                                                            <td className="px-4 py-3 text-center font-bold">{parseFloat(item.qtd).toLocaleString('pt-BR')}</td>
                                                            <td className="px-4 py-3 text-right font-medium">R$ {parseFloat(item.vUn).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                            <td className="px-4 py-3 text-right font-black">R$ {parseFloat(item.vTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : xmlData.descr ? (
                                        <div className="p-6 bg-muted/20 border border-border rounded-lg italic text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
                                            <p className="text-[10px] not-italic font-black text-primary/70 uppercase mb-3 tracking-widest">Discriminação dos Serviços</p>
                                            {xmlData.descr}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground opacity-50 border-2 border-dashed border-border rounded-xl">
                                            <Search className="h-8 w-8 mb-2" />
                                            <p className="text-sm font-medium">Não foi possível extrair os itens deste XML.</p>
                                        </div>
                                    )}

                                    <div className="mt-8 flex justify-end">
                                        <div className="flex items-center gap-2 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                                            <FileCode className="h-5 w-5 text-primary" />
                                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                                                Análise Eletrônica Polaryon • 100% Digital
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(fileType === 'xml' && !xmlData) || fileType === 'text' && (
                                <div className="w-full max-w-5xl h-full flex flex-col bg-card border border-border rounded-xl shadow-xl overflow-hidden font-mono text-[11px] leading-tight">
                                    <div className="flex items-center justify-between p-3 bg-muted border-b border-border">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                            <FileText className="h-3 w-3" /> Visualização de Texto Bruto
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{textContent?.length || 0} caracteres</span>
                                    </div>
                                    <pre className="flex-1 p-6 overflow-auto custom-scrollbar select-text bg-background text-foreground/80">
                                        {textContent || 'Aguardando conteúdo...'}
                                    </pre>
                                </div>
                            )}

                            {!fileType || (fileType !== 'image' && fileType !== 'pdf' && fileType !== 'xml' && fileType !== 'text') && (
                                <div className="flex flex-col items-center justify-center gap-6 p-12 text-center">
                                    <div className="p-6 bg-primary/5 rounded-full border-2 border-dashed border-primary/20">
                                        <FileType className="h-12 w-12 text-primary opacity-50" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-bold">Visualização Não Suportada</h3>
                                        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                                            Este formato de arquivo não pode ser pré-visualizado diretamente. Deseja fazer o download para visualizar no seu dispositivo?
                                        </p>
                                    </div>
                                    <button 
                                        onClick={handleDownload}
                                        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-black text-sm hover:scale-105 transition-all shadow-xl"
                                    >
                                        <Download className="h-5 w-5" />
                                        Baixar Arquivo Agora
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
