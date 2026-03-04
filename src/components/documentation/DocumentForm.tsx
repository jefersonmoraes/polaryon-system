import { useState, useRef } from 'react';
import { useDocumentStore, CompanyDocument, DocumentAttachment } from '@/store/document-store';
import { X, Upload, FileText, Link as LinkIcon, AlertCircle, Building2, AlignLeft, Trash2 } from 'lucide-react';

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

    const [formData, setFormData] = useState({
        title: editingDoc?.title || '',
        type: editingDoc?.type || documentTypes[0],
        issueDate: editingDoc?.issueDate || '',
        expirationDate: editingDoc?.expirationDate || '',
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            files.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const newAttachment: DocumentAttachment = {
                        id: crypto.randomUUID(),
                        fileName: file.name,
                        fileSize: file.size,
                        fileData: reader.result as string
                    };
                    setAttachments(prev => [...prev, newAttachment]);
                };
                reader.readAsDataURL(file);
            });
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeAttachment = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setAttachments(prev => prev.filter(att => att.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title || !formData.expirationDate) {
            alert('Por favor, preencha o título e a data de vencimento.');
            return;
        }

        if (editingDoc) {
            updateDocument(editingDoc.id, {
                ...formData,
                attachments,
                fileData: undefined,
                fileName: undefined,
                fileSize: undefined
            });
        } else {
            addDocument({
                ...formData,
                attachments
            });
        }

        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border border-border/50 flex flex-col max-h-[90vh]">
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
                                    <select
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    >
                                        {documentTypes.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
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
                                    <label className="text-xs font-bold text-muted-foreground uppercase">Data de Vencimento *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.expirationDate}
                                        onChange={e => setFormData({ ...formData, expirationDate: e.target.value })}
                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all [&::-webkit-calendar-picker-indicator]:dark:invert"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1"><LinkIcon className="h-3 w-3" /> Link (URL)</label>
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
                                        {attachments.map((att) => (
                                            <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card shadow-sm hover:border-primary/30 transition-colors group">
                                                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                                    <FileText className="h-4 w-4 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate" title={att.fileName}>{att.fileName}</p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {(att.fileSize / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => removeAttachment(att.id, e)}
                                                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Remover anexo"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
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
        </>
    );
};

export default DocumentForm;
