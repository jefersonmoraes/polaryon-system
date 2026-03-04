import { useState } from 'react';
import { useDocumentStore } from '@/store/document-store';
import { useCertificateStore } from '@/store/certificate-store';
import { X, FileText, Trash2, RotateCcw, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface DocsArchiveViewerProps {
    onClose: () => void;
}

const DocsArchiveViewer = ({ onClose }: DocsArchiveViewerProps) => {
    const [activeTab, setActiveTab] = useState<'documents' | 'certificates'>('documents');

    // Store access
    const { documents, restoreDocument, permanentlyDeleteDocument } = useDocumentStore();
    const { certificates, restoreCertificate, permanentlyDeleteCertificate } = useCertificateStore();

    // Filtered lists
    const trashedDocs = documents.filter(d => d.trashed);
    const trashedCerts = certificates.filter(c => c.trashed);

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-4xl rounded-xl shadow-2xl border border-border/50 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 px-6 border-b border-border/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-destructive/10 text-destructive rounded-lg">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">Lixeira de Documentação</h2>
                            <p className="text-xs text-muted-foreground">Recupere ou exclua permanentemente documentos e atestados.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted/50 rounded-full transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="flex border-b border-border/10 px-6">
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'documents'
                            ? 'border-primary text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50'
                            }`}
                    >
                        Documentos ({trashedDocs.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('certificates')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'certificates'
                            ? 'border-primary text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50'
                            }`}
                    >
                        Atestados de Capacidade ({trashedCerts.length})
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                    {activeTab === 'documents' && (
                        <div className="space-y-3">
                            {trashedDocs.length === 0 ? (
                                <div className="text-center py-12">
                                    <Trash2 className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                    <p className="text-muted-foreground">A lixeira de documentos está vazia.</p>
                                </div>
                            ) : (
                                trashedDocs.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/5 border border-border/50 rounded-lg hover:border-border transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-2 bg-primary/10 text-primary rounded shrink-0">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-medium text-sm truncate">{doc.title}</h4>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                    <span>{doc.type}</span>
                                                    <span>•</span>
                                                    <span>Excluído recentemente</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 shrink-0 ml-4">
                                            <button
                                                onClick={() => restoreDocument(doc.id)}
                                                className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors"
                                                title="Restaurar"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(`Tem certeza que deseja excluir "${doc.title}" permanentemente? Isso não pode ser desfeito.`)) {
                                                        permanentlyDeleteDocument(doc.id);
                                                    }
                                                }}
                                                className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
                                                title="Excluir Permanentemente"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'certificates' && (
                        <div className="space-y-3">
                            {trashedCerts.length === 0 ? (
                                <div className="text-center py-12">
                                    <Trash2 className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                    <p className="text-muted-foreground">A lixeira de atestados está vazia.</p>
                                </div>
                            ) : (
                                trashedCerts.map(cert => (
                                    <div key={cert.id} className="flex items-center justify-between p-3 bg-muted/5 border border-border/50 rounded-lg hover:border-border transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-2 bg-primary/10 text-primary rounded shrink-0">
                                                <AlertCircle className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-medium text-sm truncate">{cert.issuingAgency} - {cert.suppliedItems}</h4>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                    <span className="font-bold">{cert.type}</span>
                                                    <span>•</span>
                                                    <span>{format(new Date(cert.executionDate), 'dd/MM/yyyy')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 shrink-0 ml-4">
                                            <button
                                                onClick={() => restoreCertificate(cert.id)}
                                                className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors"
                                                title="Restaurar"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(`Tem certeza que deseja excluir esse atestado permanentemente? Isso não pode ser desfeito.`)) {
                                                        permanentlyDeleteCertificate(cert.id);
                                                    }
                                                }}
                                                className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
                                                title="Excluir Permanentemente"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocsArchiveViewer;
