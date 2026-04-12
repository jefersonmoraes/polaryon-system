import { useState, useRef } from 'react';
import { useDocumentStore, CompanyDocument, DocumentAttachment } from '@/store/document-store';
import { X, Upload, FileText, Link as LinkIcon, AlertCircle, Building2, AlignLeft, Trash2, Search, Paperclip, ExternalLink } from 'lucide-react';
import { cn, compressImage, openFileInNewTab } from '@/lib/utils';
import { FilePreviewModal } from '../ui/FilePreviewModal';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface DocumentFormProps {
    onClose: () => void;
    editingDoc?: CompanyDocument;
}

const documentTypes = [
    'Habilitação jurídica',
    'Regularidade fiscal',
    'Regularidade trabalhista',
    'Regularidade FGTS',
    'Regime tributário',
    'Econômico-financeira',
    'Qualificação técnica',
    'Declarações editalícias',
    'Garantias',
    'Assinatura digital',
    'Setorial (quando exigido)',
    'Outros'
];

const DocumentForm = ({ onClose, editingDoc }: DocumentFormProps) => {
    const { addDocument, updateDocument } = useDocumentStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);

    const [formData, setFormData] = useState({
        title: editingDoc?.title || '',
        type: editingDoc?.type || documentTypes[0],
        issueDate: editingDoc?.issueDate?.split('T')[0] || '',
        expirationDate: editingDoc?.expirationDate?.split('T')[0] || '',
        link: editingDoc?.link || '',
        description: editingDoc?.description || '',
        observations: editingDoc?.observations || '',
        whereToIssue: editingDoc?.whereToIssue || '',
    });

    const [attachments, setAttachments] = useState<DocumentAttachment[]>(() => {
        if (editingDoc?.attachments && editingDoc.attachments.length > 0) {
            return editingDoc.attachments;
        }
        if (editingDoc?.fileData && editingDoc?.fileName) {
            return [{
                id: crypto.randomUUID(),
                fileName: editingDoc.fileName,
                fileSize: editingDoc.fileSize || 0,
                fileData: editingDoc.fileData
            }];
        }
        return [];
    });

    const [isDragging, setIsDragging] = useState(false);
    const [previewData, setPreviewData] = useState<{ isOpen: boolean; url: string; name: string; type?: string }>({
        isOpen: false,
        url: '',
        name: '',
    });

    const processFiles = async (files: File[]) => {
        if (!files.length) return;
        
        const toastId = toast.loading(`Processando ${files.length} arquivo(s)...`);
        
        try {
            const newAttachments: DocumentAttachment[] = [];
            
            for (const file of files) {
                let fileData: string;

                if (file.type.startsWith('image/') && !file.type.includes('svg')) {
                    try {
                        fileData = await compressImage(file);
                    } catch (err) {
                        fileData = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.readAsDataURL(file);
                        });
                    }
                } else {
                    fileData = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    });
                }

                newAttachments.push({
                    id: crypto.randomUUID(),
                    fileName: file.name,
                    fileSize: file.size,
                    fileData
                });
            }

            setAttachments(prev => [...prev, ...newAttachments]);
            toast.success(`${files.length} arquivo(s) anexados.`, { id: toastId });
        } catch (error) {
            toast.error("Erro ao processar arquivos.", { id: toastId });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        processFiles(files);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            processFiles(files);
        }
    };

    const removeAttachment = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setAttachments(prev => prev.filter(att => att.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title) {
            alert('Por favor, preencha o título.');
            return;
        }

        const payload = {
            ...formData,
            attachments,
            // Mantém compatibilidade com o esquema atual do banco (campos legados)
            fileData: attachments.length > 0 ? attachments[0].fileData : undefined,
            fileName: attachments.length > 0 ? attachments[0].fileName : undefined,
            fileSize: attachments.length > 0 ? attachments[0].fileSize : undefined,
        };

        if (editingDoc) {
            updateDocument(editingDoc.id, payload);
        } else {
            addDocument(payload);
        }

        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div 
                    className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border border-border/50 flex flex-col max-h-[90vh] relative overflow-hidden"
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    {/* Drag & Drop Overlay */}
                    <AnimatePresence>
                        {isDragging && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-[100] bg-primary/10 backdrop-blur-[2px] border-4 border-dashed border-primary flex flex-col items-center justify-center p-6 pointer-events-none"
                            >
                                <div className="bg-background/90 p-8 rounded-full shadow-2xl border-2 border-primary animate-pulse">
                                    <Paperclip className="h-16 w-16 text-primary" />
                                </div>
                                <h3 className="mt-6 text-2xl font-black text-primary uppercase tracking-tighter">Solte para anexar documentos</h3>
                                <p className="text-sm font-bold text-muted-foreground mt-2">Imagens serão otimizadas automaticamente</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="flex items-center justify-between p-4 px-6 border-b border-border/10 bg-muted/10 shrink-0">
                        <h2 className="font-bold text-lg">
                            {editingDoc ? 'Editar Documento' : 'Novo Documento'}
                        </h2>
                        <button onClick={onClose} className="p-1.5 hover:bg-muted/50 rounded-full transition-colors">
                            <X className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <form id="doc-form" onSubmit={handleSubmit} className="space-y-4">

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase">Título do Documento *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        placeholder="Ex: Alvará de Funcionamento"
                                    />
                                </div>
                                <div className="space-y-1 col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase">Tipo do Documento</label>
                                    <Select 
                                        value={formData.type} 
                                        onValueChange={v => setFormData({ ...formData, type: v })}
                                    >
                                        <SelectTrigger className="w-full bg-background border border-border rounded px-3 h-9 text-sm focus:ring-1 focus:ring-primary transition-all font-bold">
                                            <SelectValue placeholder="Selecione o tipo..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border max-h-[300px]">
                                            {documentTypes.map(type => (
                                                <SelectItem key={type} value={type} className="text-xs font-bold">
                                                    {type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase">Data de Emissão</label>
                                    <input
                                        type="date"
                                        value={formData.issueDate}
                                        onChange={e => setFormData({ ...formData, issueDate: e.target.value })}
                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all [&::-webkit-calendar-picker-indicator]:dark:invert"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase">Data de Vencimento</label>
                                    <input
                                        type="date"
                                        value={formData.expirationDate}
                                        onChange={e => setFormData({ ...formData, expirationDate: e.target.value })}
                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all [&::-webkit-calendar-picker-indicator]:dark:invert"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-muted-foreground uppercase flex justify-between items-center w-full">
                                    <span className="flex items-center gap-1"><LinkIcon className="h-3 w-3" /> Link (URL)</span>
                                    {formData.link && (
                                        <a 
                                            href={formData.link.startsWith('http') ? formData.link : `https://${formData.link}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-[10px] text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded transition-colors"
                                            title="Acessar link em nova guia"
                                        >
                                            Acessar Link <LinkIcon className="h-2.5 w-2.5" />
                                        </a>
                                    )}
                                </label>
                                <input
                                    type="url"
                                    value={formData.link}
                                    onChange={e => setFormData({ ...formData, link: e.target.value })}
                                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    placeholder="Ex: https://receita.fazenda.gov.br/..."
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1"><AlignLeft className="h-3 w-3" /> Descrição</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none h-20 placeholder:text-muted-foreground/50 text-foreground"
                                    placeholder="Descreva detalhes adicionais deste documento..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Observações (Obs.)</label>
                                    <textarea
                                        value={formData.observations}
                                        onChange={e => setFormData({ ...formData, observations: e.target.value })}
                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none h-16 placeholder:text-muted-foreground/50 text-foreground"
                                        placeholder="Ex: Renovar 10 dias antes..."
                                    />
                                </div>
                                <div className="space-y-1 col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1"><Building2 className="h-3 w-3" /> Onde emitir</label>
                                    <textarea
                                        value={formData.whereToIssue}
                                        onChange={e => setFormData({ ...formData, whereToIssue: e.target.value })}
                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none h-16 placeholder:text-muted-foreground/50 text-foreground"
                                        placeholder="Ex: Site da Receita Federal / Portal Gov..."
                                    />
                                </div>
                            </div>


                            <div className="space-y-1 pt-4">
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 flex justify-between items-center">
                                    <span>Anexos ({attachments.length})</span>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-[10px] text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Upload className="h-3 w-3" /> Adicionar arquivo
                                    </button>
                                </label>

                                {attachments.length === 0 ? (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-border/50 hover:border-primary/50 bg-muted/10 hover:bg-muted/20 rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center"
                                    >
                                        <div className="h-10 w-10 bg-background rounded-full flex items-center justify-center shadow-sm mb-1">
                                            <Upload className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium">Clique para arrastar ou adicionar arquivos</p>
                                        <p className="text-xs text-muted-foreground">PDF, JPG, PNG e etc.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                        {attachments.map((att) => {
                                            const isImage = att.fileData.startsWith('data:image');
                                            const isPdf = att.fileData.startsWith('data:application/pdf');
                                            const fileType = isImage ? 'image' : isPdf ? 'pdf' : undefined;

                                            return (
                                                <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card shadow-sm hover:border-primary/30 transition-colors group">
                                                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                                                        {isImage ? (
                                                            <img src={att.fileData} className="w-full h-full object-cover" alt="" />
                                                        ) : (
                                                            <FileText className="h-4 w-4 text-primary" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium truncate" title={att.fileName}>{att.fileName}</p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {(att.fileSize / 1024 / 1024).toFixed(2)} MB
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewData({ isOpen: true, url: att.fileData, name: att.fileName, type: fileType })}
                                                            className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
                                                            title="Visualizar"
                                                        >
                                                            <Search className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => openFileInNewTab(att.fileData, att.fileName)} 
                                                            className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors flex items-center justify-center"
                                                            title="Abrir em Nova Aba"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => removeAttachment(att.id, e)}
                                                            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                            title="Remover anexo"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <input
                                    type="file"
                                    multiple
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                        </form>
                    </div>

                    <div className="p-4 border-t border-border/10 bg-muted/5 shrink-0 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 rounded transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="doc-form"
                            className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            {editingDoc ? 'Salvar Alterações' : 'Cadastrar Documento'}
                        </button>
                    </div>
                </div>
            </div>
            <FilePreviewModal
                isOpen={previewData.isOpen}
                onClose={() => setPreviewData(prev => ({ ...prev, isOpen: false }))}
                fileUrl={previewData.url}
                fileName={previewData.name}
                fileType={previewData.type}
            />
        </>
    );
};

export default DocumentForm;
