import { useState, useRef, useEffect } from 'react';
import { useModelStore, EssentialModel, ModelAttachment } from '@/store/model-store';
import { X, Upload, FileText, CheckCircle, AlignLeft, Type, Paperclip, Search, Trash2, ExternalLink } from 'lucide-react';
import { cn, compressImage, getSafeProxyUrl, normalizeFileUrl } from '@/lib/utils';
import { FilePreviewModal } from '../ui/FilePreviewModal';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface EssentialModelFormProps {
    onClose: () => void;
    editingModel?: EssentialModel;
}

const EssentialModelForm = ({ onClose, editingModel }: EssentialModelFormProps) => {
    const { addModel, updateModel } = useModelStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        title: editingModel?.title || '',
        description: editingModel?.description || '',
    });

    const [attachment, setAttachment] = useState<ModelAttachment | null>(
        editingModel?.attachments && editingModel.attachments.length > 0
            ? editingModel.attachments[0]
            : null
    );

    // Drag and Drop State
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    // Preview State
    const [previewData, setPreviewData] = useState<{ isOpen: boolean; url: string; name: string; type?: string }>({
        isOpen: false,
        url: '',
        name: '',
    });

    const processFiles = async (files: File[]) => {
        if (!files.length) return;
        
        const toastId = toast.loading(`Processando arquivo...`);
        const file = files[0]; // Este formulário suporta apenas um arquivo base

        try {
            let fileData: string;

            if (file.type.startsWith('image/') && !file.type.includes('svg')) {
                try {
                    fileData = await compressImage(file);
                } catch (err) {
                    console.error("Compression failed", err);
                    fileData = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    });
                }
            } else {
                fileData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            setAttachment({
                id: crypto.randomUUID(),
                fileName: file.name,
                fileSize: file.size,
                fileData: fileData
            });
            
            toast.success(`Arquivo pronto para cadastro.`, { id: toastId });
        } catch (error) {
            toast.error("Erro ao processar arquivo.", { id: toastId });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        processFiles(files);
        e.target.value = '';
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

    const removeAttachment = (e: React.MouseEvent) => {
        e.stopPropagation();
        setAttachment(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title || !formData.description) {
            alert('Por favor, preencha o título e a descrição do modelo.');
            return;
        }

        const attachmentsArray = attachment ? [attachment] : [];

        if (editingModel) {
            updateModel(editingModel.id, {
                ...formData,
                attachments: attachmentsArray
            });
        } else {
            addModel({
                ...formData,
                attachments: attachmentsArray
            });
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div 
                className="bg-card w-full max-w-xl rounded-xl shadow-2xl border border-border/50 flex flex-col max-h-[90vh] relative overflow-hidden"
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
                            <h3 className="mt-6 text-2xl font-black text-primary uppercase tracking-tighter">Solte para anexar o modelo</h3>
                            <p className="text-sm font-bold text-muted-foreground mt-2">Imagens serão otimizadas automaticamente</p>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div className="flex items-center justify-between p-4 px-6 border-b border-border/10 bg-muted/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">
                                {editingModel ? 'Editar Modelo de Documento' : 'Novo Modelo de Documento'}
                            </h2>
                            <p className="text-xs text-muted-foreground">Cadastre um modelo ou anexe o arquivo base.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-muted/50 rounded-full transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <form id="model-form" onSubmit={handleSubmit} className="space-y-6">

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Type className="h-4 w-4 text-primary" />
                                    Título do Modelo <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Ofício de Solicitação"
                                    className="w-full p-2 bg-background border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <AlignLeft className="h-4 w-4 text-muted-foreground" />
                                    Descrição de Uso <span className="text-destructive">*</span>
                                </label>
                                <textarea
                                    required
                                    placeholder="Explique quando usar este modelo e do que se trata..."
                                    className="w-full p-2 bg-background border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all min-h-[100px] resize-none placeholder:text-muted-foreground/30 custom-scrollbar"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Attachment Slot */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium flex items-center gap-2 border-b border-border/50 pb-2">
                                <Upload className="h-4 w-4 text-primary" />
                                Arquivo Base / Modelo (Opcional)
                            </label>

                            <div className={`border rounded-lg p-4 transition-colors ${attachment ? 'bg-primary/5 border-primary/30' : 'bg-card border-border border-dashed hover:border-primary/50'}`}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".pdf,.doc,.docx"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />

                                {attachment ? (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-foreground uppercase tracking-widest text-[10px]">Arquivo Anexado</span>
                                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                                        </div>
                                        <div className="group relative flex items-center gap-3 overflow-hidden bg-background p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-all">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <FileText className="h-5 w-5 text-primary shrink-0" />
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-xs font-bold truncate text-foreground">
                                                    {attachment.fileName}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground uppercase font-medium">
                                                    {(attachment.fileSize / 1024).toFixed(1)} KB
                                                </span>
                                            </div>

                                            {/* Ações Rápidas */}
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewData({ isOpen: true, url: attachment.fileData, name: attachment.fileName, type: attachment.fileData.startsWith('data:image') ? 'image' : attachment.fileData.startsWith('data:application/pdf') ? 'pdf' : undefined })}
                                                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all shadow-sm"
                                                    title="Visualizar Digitalmente"
                                                >
                                                    <Search className="h-3.5 w-3.5" />
                                                </button>
                                                <a 
                                                    href={getSafeProxyUrl(normalizeFileUrl(attachment.fileData, attachment.fileName))} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="p-2 text-primary hover:bg-primary/10 bg-transparent rounded-lg transition-all"
                                                    title="Abrir em Nova Aba"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={removeAttachment}
                                                    className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive hover:text-white transition-all shadow-sm"
                                                    title="Remover Anexo"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full py-8 flex flex-col items-center justify-center gap-3 group bg-muted/5 hover:bg-primary/5 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/40 transition-all"
                                    >
                                        <div className="p-4 bg-muted rounded-full group-hover:bg-primary/10 group-hover:text-primary transition-all group-hover:scale-110">
                                            <Upload className="h-6 w-6" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-bold uppercase tracking-wider group-hover:text-primary transition-colors">Arraste ou clique aqui</p>
                                            <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">Suporta PDF, Word (.doc, .docx) ou Imagens</p>
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>

                    </form>
                </div>

                <div className="p-4 px-6 border-t border-border/10 flex justify-end gap-3 bg-muted/10 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 hover:bg-muted font-medium text-sm rounded transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="model-form"
                        className="bg-primary text-primary-foreground px-6 py-2 rounded font-medium text-sm hover:bg-primary/90 shadow-sm transition-colors"
                    >
                        {editingModel ? 'Salvar Edição' : 'Cadastrar Modelo'}
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

export default EssentialModelForm;
