import { useState, useRef } from 'react';
import { useModelStore, EssentialModel, ModelAttachment } from '@/store/model-store';
import { X, Upload, FileText, CheckCircle, AlignLeft, Type } from 'lucide-react';

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachment({
                    id: crypto.randomUUID(),
                    fileName: file.name,
                    fileSize: file.size,
                    fileData: reader.result as string
                });
            };
            reader.readAsDataURL(file);
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
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
            <div className="bg-card w-full max-w-xl rounded-xl shadow-2xl border border-border/50 flex flex-col max-h-[90vh]">
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
                                            <span className="text-sm font-bold text-foreground">Arquivo Anexado</span>
                                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                                        </div>
                                        <div className="flex items-center gap-2 overflow-hidden bg-background p-2 rounded border border-border/50">
                                            <FileText className="h-5 w-5 text-primary shrink-0" />
                                            <span className="text-xs truncate text-muted-foreground flex-1">
                                                {attachment.fileName}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={removeAttachment}
                                            className="text-xs text-destructive hover:underline font-medium w-full text-center py-2 bg-destructive/5 hover:bg-destructive/10 rounded transition-colors mt-2"
                                        >
                                            Remover Arquivo
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full py-8 flex flex-col items-center justify-center gap-3 group"
                                    >
                                        <div className="p-3 bg-muted rounded-full group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                            <Upload className="h-6 w-6" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium group-hover:text-primary transition-colors">Clique para anexar arquivo base</p>
                                            <p className="text-xs text-muted-foreground mt-1">PDF ou Word (.doc, .docx)</p>
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
        </div>
    );
};

export default EssentialModelForm;
