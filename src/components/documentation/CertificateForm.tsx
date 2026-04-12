import { useState, useRef } from 'react';
import { useCertificateStore, CapacityCertificate, CertificateAttachment } from '@/store/certificate-store';
import { X, Upload, FileText, AlertCircle, Building2, AlignLeft, Calendar, FileBadge, CheckCircle, Search, Paperclip, Trash2 } from 'lucide-react';
import { cn, compressImage } from '@/lib/utils';
import { FilePreviewModal } from '../ui/FilePreviewModal';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useKanbanStore } from '@/store/kanban-store';

interface CertificateFormProps {
    onClose: () => void;
    editingCert?: CapacityCertificate;
}

const documentSlots: CertificateAttachment['fileSlot'][] = [
    'Atestado', 'NF', 'Contrato', 'Nota de Empenho', 'Relatório de execução'
];

type FileState = {
    [key in CertificateAttachment['fileSlot']]?: CertificateAttachment;
};

const CertificateForm = ({ onClose, editingCert }: CertificateFormProps) => {
    const { addCertificate, updateCertificate } = useCertificateStore();
    const { cards } = useKanbanStore();

    // Hidden file inputs mapped by slot
    const fileInputRefs: Record<string, React.RefObject<HTMLInputElement>> = {
        'Atestado': useRef<HTMLInputElement>(null),
        'NF': useRef<HTMLInputElement>(null),
        'Contrato': useRef<HTMLInputElement>(null),
        'Nota de Empenho': useRef<HTMLInputElement>(null),
        'Relatório de execução': useRef<HTMLInputElement>(null),
    };

    const dragCounter = useRef(0);
    const [isDraggingOverall, setIsDraggingOverall] = useState(false);
    const [draggingSlot, setDraggingSlot] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        type: editingCert?.type || ['Serviço'],
        suppliedItems: editingCert?.suppliedItems || '',
        suppliedQuantity: editingCert?.suppliedQuantity || '',
        kanbanCardId: editingCert?.kanbanCardId || '',
        issuingAgency: editingCert?.issuingAgency || '',
        executionDate: editingCert?.executionDate?.split('T')[0] || '',
        description: editingCert?.description || '',
    });

    const handleTypeChange = (value: 'Produto' | 'Serviço') => {
        setFormData(prev => {
            const currentTypes = prev.type;
            if (currentTypes.includes(value)) {
                // If it's the last one, don't allow unchecking (must have at least one type)
                if (currentTypes.length === 1) return prev;
                return { ...prev, type: currentTypes.filter(t => t !== value) };
            } else {
                return { ...prev, type: [...currentTypes, value] };
            }
        });
    };

    const [attachments, setAttachments] = useState<FileState>(() => {
        const initialMap: FileState = {};
        if (editingCert?.attachments) {
            editingCert.attachments.forEach(att => {
                initialMap[att.fileSlot] = att;
            });
        }
        return initialMap;
    });

    const [previewData, setPreviewData] = useState<{ isOpen: boolean; url: string; name: string; type?: string }>({
        isOpen: false,
        url: '',
        name: '',
    });

    const processFile = async (slot: CertificateAttachment['fileSlot'], file: File) => {
        const toastId = toast.loading(`Processando ${file.name}...`);
        
        try {
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

            const newAttachment: CertificateAttachment = {
                id: crypto.randomUUID(),
                fileSlot: slot,
                fileName: file.name,
                fileSize: file.size,
                fileData
            };

            setAttachments(prev => ({
                ...prev,
                [slot]: newAttachment
            }));
            
            toast.success(`Arquivo adicionado em ${slot}.`, { id: toastId });
        } catch (error) {
            toast.error("Erro ao processar arquivo.", { id: toastId });
        }
    };

    const handleFileChange = (slot: CertificateAttachment['fileSlot'], e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(slot, file);
        }
        if (fileInputRefs[slot].current) {
            fileInputRefs[slot].current!.value = '';
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleSlotDragEnter = (slot: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggingSlot(slot);
    };

    const handleSlotDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggingSlot(null);
    };

    const handleSlotDrop = (slot: CertificateAttachment['fileSlot'], e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggingSlot(null);
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            processFile(slot, files[0]);
        }
    };

    const removeAttachment = (slot: CertificateAttachment['fileSlot'], e: React.MouseEvent) => {
        e.stopPropagation();
        setAttachments(prev => {
            const newState = { ...prev };
            delete newState[slot];
            return newState;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.issuingAgency || !formData.suppliedItems || !formData.executionDate) {
            alert('Por favor, preencha o órgão emissor, os itens fornecidos e a data de execução.');
            return;
        }

        const attachmentsArray = Object.values(attachments).filter(Boolean) as CertificateAttachment[];

        if (editingCert) {
            updateCertificate(editingCert.id, {
                ...formData,
                type: formData.type as ('Produto' | 'Serviço')[],
                attachments: attachmentsArray
            });
        } else {
            addCertificate({
                ...formData,
                type: formData.type as ('Produto' | 'Serviço')[],
                attachments: attachmentsArray
            });
        }

        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-card w-full max-w-3xl rounded-xl shadow-2xl border border-border/50 flex flex-col max-h-[90vh]">
                    <div className="flex items-center justify-between p-4 px-6 border-b border-border/10 bg-muted/10 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                <FileBadge className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg">
                                    {editingCert ? 'Editar Atestado de Capacidade' : 'Novo Atestado de Capacidade'}
                                </h2>
                                <p className="text-xs text-muted-foreground">Preencha as informações técnicas e anexe os comprovantes.</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-muted/50 rounded-full transition-colors">
                            <X className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        <form id="certificate-form" onSubmit={handleSubmit} className="space-y-6">

                            {/* Grid 1: Basic Classification */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-primary" />
                                        Órgão Emissor <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Prefeitura de São Paulo"
                                        className="w-full p-2 bg-background border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30"
                                        value={formData.issuingAgency}
                                        onChange={(e) => setFormData({ ...formData, issuingAgency: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-primary" />
                                        Data de Execução <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full p-2 bg-background border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all [&::-webkit-calendar-picker-indicator]:dark:invert"
                                        value={formData.executionDate}
                                        onChange={(e) => setFormData({ ...formData, executionDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Grid 2: Details */}
                            <div className="grid grid-cols-1 gap-4 bg-muted/5 p-4 rounded-lg border border-border/50">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                                        Tipo de Fornecimento <span className="text-destructive">*</span>
                                    </label>
                                    <div className="flex gap-4 mt-2">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                name="type"
                                                value="Serviço"
                                                checked={formData.type.includes('Serviço')}
                                                onChange={() => handleTypeChange('Serviço')}
                                                className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                                            />
                                            <span className="text-sm font-medium group-hover:text-primary transition-colors">Serviço Prestado</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                name="type"
                                                value="Produto"
                                                checked={formData.type.includes('Produto')}
                                                onChange={() => handleTypeChange('Produto')}
                                                className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                                            />
                                            <span className="text-sm font-medium group-hover:text-primary transition-colors">Venda de Produto</span>
                                        </label>
                                    </div>
                                </div>

                                {formData.type.includes('Produto') && (
                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                            Quantidade de Itens Fornecidos
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: 500 unidades, 20 caixas..."
                                            className="w-full p-2 bg-background border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30"
                                            value={formData.suppliedQuantity}
                                            onChange={(e) => setFormData({ ...formData, suppliedQuantity: e.target.value })}
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        Itens Fornecidos ou Serviçoss <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Descreva resumidamente os itens ou escopo..."
                                        className="w-full p-2 bg-background border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30"
                                        value={formData.suppliedItems}
                                        onChange={(e) => setFormData({ ...formData, suppliedItems: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Search className="h-4 w-4 text-muted-foreground" />
                                        Cartão Relacionado (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        list="kanban-cards"
                                        placeholder="Digite ou selecione um cartão..."
                                        className="w-full p-2 bg-background border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30"
                                        value={formData.kanbanCardId}
                                        onChange={(e) => setFormData({ ...formData, kanbanCardId: e.target.value })}
                                    />
                                    <datalist id="kanban-cards">
                                        {cards.filter(c => !c.archived && !c.trashed).map(card => (
                                            <option key={card.id} value={card.id}>
                                                {card.title}
                                            </option>
                                        ))}
                                    </datalist>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Vincule este atestado a um cartão/projeto existente para referências futuras.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <AlignLeft className="h-4 w-4 text-muted-foreground" />
                                        Descrição Detalhada / Observações
                                    </label>
                                    <textarea
                                        placeholder="Adicione informações extras ou anotações..."
                                        className="w-full p-2 bg-background border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all min-h-[80px] resize-none placeholder:text-muted-foreground/30 custom-scrollbar"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Grid 3: Attachment Slots */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium flex items-center gap-2 border-b border-border/50 pb-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    Documentos Comprobatórios
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {documentSlots.map((slot) => {
                                        const attachment = attachments[slot];
                                        const isDraggingThisSlot = draggingSlot === slot;

                                        return (
                                            <div 
                                                key={slot} 
                                                className={cn(
                                                    "border rounded-lg p-3 transition-all relative overflow-hidden",
                                                    attachment ? 'bg-primary/5 border-primary/30' : 'bg-card border-border border-dashed hover:border-primary/50',
                                                    isDraggingThisSlot && "border-primary bg-primary/10 border-solid"
                                                )}
                                                onDragEnter={(e) => handleSlotDragEnter(slot, e)}
                                                onDragLeave={handleSlotDragLeave}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleSlotDrop(slot, e)}
                                            >
                                                <AnimatePresence>
                                                    {isDraggingThisSlot && (
                                                        <motion.div 
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            className="absolute inset-0 z-10 flex items-center justify-center bg-primary/20 backdrop-blur-[1px] pointer-events-none"
                                                        >
                                                            <Upload className="h-6 w-6 text-primary animate-bounce" />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                                <input
                                                    type="file"
                                                    ref={fileInputRefs[slot]}
                                                    accept=".pdf,image/*"
                                                    onChange={(e) => handleFileChange(slot, e)}
                                                    className="hidden"
                                                />

                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-foreground">{slot}</span>
                                                    {attachment && (
                                                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                                                    )}
                                                </div>

                                                {attachment ? (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-2 overflow-hidden bg-background p-1.5 rounded border border-border/50">
                                                            {attachment.fileData.startsWith('data:image') ? (
                                                                <img src={attachment.fileData} className="w-5 h-5 rounded object-cover shrink-0" alt="" />
                                                            ) : (
                                                                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                                                            )}
                                                            <span className="text-[10px] truncate text-muted-foreground flex-1">
                                                                {attachment.fileName}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const isImage = attachment.fileData.startsWith('data:image');
                                                                    const isPdf = attachment.fileData.startsWith('data:application/pdf');
                                                                    setPreviewData({
                                                                        isOpen: true,
                                                                        url: attachment.fileData,
                                                                        name: attachment.fileName,
                                                                        type: isImage ? 'image' : isPdf ? 'pdf' : undefined
                                                                    });
                                                                }}
                                                                className="flex-1 text-[10px] text-primary hover:bg-primary/10 py-1 rounded border border-primary/20 transition-all font-bold flex items-center justify-center gap-1"
                                                            >
                                                                <Search className="h-2.5 w-2.5" /> Preview
                                                            </button>
                                                            <a 
                                                                href={attachment.fileData} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="px-2 text-primary hover:bg-primary/10 py-1 rounded border border-primary/20 transition-all flex items-center justify-center"
                                                                title="Abrir em Nova Aba"
                                                            >
                                                                <ExternalLink className="h-3 w-3" />
                                                            </a>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => removeAttachment(slot, e)}
                                                                className="p-1 px-2 text-destructive hover:bg-destructive/10 rounded transition-colors border border-destructive/20"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRefs[slot].current?.click()}
                                                        className="w-full py-4 flex flex-col items-center justify-center gap-1.5 group"
                                                    >
                                                        <div className="p-1.5 bg-muted rounded-full group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                            <Upload className="h-3 w-3" />
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground font-medium group-hover:text-primary transition-colors">Adicionar arquivo</span>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
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
                            form="certificate-form"
                            className="bg-primary text-primary-foreground px-6 py-2 rounded font-medium text-sm hover:bg-primary/90 shadow-sm transition-colors"
                        >
                            {editingCert ? 'Salvar Alterações' : 'Cadastrar Atestado'}
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

export default CertificateForm;
