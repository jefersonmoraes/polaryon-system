import { useState, useRef, useEffect } from 'react';
import { useEssentialDocumentStore, EssentialDocumentModel, EssentialDocumentAttachment } from '@/store/essential-document-store';
import { X, Upload, FileText, Trash2, Save, File, Search, Paperclip } from 'lucide-react';
import { cn, compressImage } from '@/lib/utils';
import { FilePreviewModal } from '../ui/FilePreviewModal';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface EssentialDocumentModelFormProps {
    onClose: () => void;
    editingModel?: EssentialDocumentModel;
}

const EssentialDocumentModelForm = ({ onClose, editingModel }: EssentialDocumentModelFormProps) => {
    const { addModel, updateModel } = useEssentialDocumentStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);

    const [title, setTitle] = useState(editingModel?.title || '');
    const [description, setDescription] = useState(editingModel?.description || '');
    const [attachments, setAttachments] = useState<EssentialDocumentAttachment[]>(editingModel?.attachments || []);
    const [error, setError] = useState('');
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
            const newAttachments: EssentialDocumentAttachment[] = [];
            
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(att => att.id !== id));
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!title.trim()) {
            setError('O título é obrigatório.');
            return;
        }

        const modelData = {
            title: title.trim(),
            description: description.trim(),
            attachments
        };

        if (editingModel) {
            updateModel(editingModel.id, modelData);
        } else {
            addModel(modelData);
        }

        onClose();
    };

    return (
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
                            <h3 className="mt-6 text-2xl font-black text-primary uppercase tracking-tighter">Solte para anexar modelos</h3>
                            <p className="text-sm font-bold text-muted-foreground mt-2">Imagens serão otimizadas automaticamente</p>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div className="flex items-center justify-between p-4 px-6 border-b border-border/10">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        {editingModel ? 'Editar Modelo' : 'Novo Modelo de Documento'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted/50 rounded-full transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                    <form id="model-form" onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
                                <span className="font-medium">Erro:</span> {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Título do Modelo <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ex: Pedido de Esclarecimentos"
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Descrição
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Descreva sobre o que se trata este modelo..."
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Anexos (Modelos Prontos)
                                </label>

                                <div className="space-y-3">
                                    {attachments.length > 0 && (
                                        <div className="space-y-2">
                                            {attachments.map(att => {
                                                const isImage = att.fileData.startsWith('data:image');
                                                const isPdf = att.fileData.startsWith('data:application/pdf');
                                                const fileType = isImage ? 'image' : isPdf ? 'pdf' : undefined;

                                                return (
                                                    <div key={att.id} className="flex items-center justify-between p-2.5 bg-muted/30 border border-border/50 rounded-lg group">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="p-1.5 bg-primary/10 text-primary rounded shrink-0 overflow-hidden w-8 h-8 flex items-center justify-center">
                                                                {isImage ? (
                                                                    <img src={att.fileData} className="w-full h-full object-cover" alt="" />
                                                                ) : (
                                                                    <File className="h-4 w-4" />
                                                                )}
                                                            </div>
                                                            <div className="truncate">
                                                                <p className="text-sm font-medium truncate">{att.fileName}</p>
                                                                <p className="text-[10px] text-muted-foreground">{formatFileSize(att.fileSize)}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewData({ isOpen: true, url: att.fileData, name: att.fileName, type: fileType })}
                                                                className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                                                                title="Visualizar"
                                                            >
                                                                <Search className="h-4 w-4" />
                                                            </button>
                                                            <a
                                                                href={att.fileData}
                                                                download={att.fileName}
                                                                className="p-1.5 text-muted-foreground hover:bg-muted/50 rounded-md transition-colors"
                                                                title="Baixar arquivo"
                                                            >
                                                                <Upload className="h-4 w-4 rotate-180" />
                                                            </a>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeAttachment(att.id)}
                                                                className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                                                title="Remover arquivo"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-border/50 rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/10 transition-colors"
                                    >
                                        <div className="p-3 bg-primary/5 text-primary rounded-full">
                                            <Upload className="h-6 w-6" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium">Clique para anexar arquivos</p>
                                            <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX (Max 5MB)</p>
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            onChange={handleFileSelect}
                                            className="hidden"
                                            accept=".pdf,.doc,.docx"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-4 px-6 border-t border-border/10 bg-muted/10 flex justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="model-form"
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <Save className="h-4 w-4" />
                        {editingModel ? 'Salvar Alterações' : 'Salvar Modelo'}
                    </button>
                </div>
            </div>
            <FilePreviewModal
                isOpen={previewData.isOpen}
                onClose={() => setPreviewData(prev => ({ ...prev, isOpen: false }))}
                fileUrl={previewData.url}
                fileName={previewData.name}
                fileType={previewData.type}
            />
        </div>
    );
};

export default EssentialDocumentModelForm;
