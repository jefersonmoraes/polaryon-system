import { useState } from 'react';
import { useDocumentStore, CompanyDocument } from '@/store/document-store';
import { Plus, Search, FileText, AlertTriangle, CheckCircle, Trash2, Edit, LayoutList, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import DocumentForm from '@/components/documentation/DocumentForm';
import DocumentCalendarView from '@/components/documentation/DocumentCalendarView';
import { fixDateToBRT } from '@/lib/utils';

import { useAuthStore } from '@/store/auth-store';
import { useKanbanStore } from '@/store/kanban-store';
import { useEffect } from 'react';

const DocumentationPage = () => {
    const { currentUser } = useAuthStore();
    const canEdit = currentUser?.permissions?.canEdit ?? false;
    const { documents, trashDocument } = useDocumentStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState('Todos');
    const [selectedStatus, setSelectedStatus] = useState('Todos');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<CompanyDocument | null>(null);
    const { fetchKanbanData } = useKanbanStore();

    useEffect(() => {
        // Force refresh on mount and if documents are empty
        console.log('DocumentationPage - Component Mounted, fetching data...');
        fetchKanbanData();
    }, [fetchKanbanData]);

    // Extra safeguard: if documents is still empty after 2 seconds, try one more time
    useEffect(() => {
        if (documents.length === 0) {
            const timer = setTimeout(() => {
                console.log('DocumentationPage - Documents still empty, retrying sync...');
                fetchKanbanData();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [documents.length, fetchKanbanData]);

    console.log('DocumentationPage - Current Documents:', documents);

    const documentTypes = [
        "Habilitação jurídica", "Regularidade fiscal", "Regularidade trabalhista",
        "Regularidade FGTS", "Regime tributário", "Econômico-financeira",
        "Qualificação técnica", "Declarações editalícias", "Garantias",
        "Assinatura digital", "Setorial"
    ];

    const filteredDocs = documents.filter(doc => {
        if (doc.trashed) return false;

        const matchesSearch = (doc.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (doc.type || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = selectedType === 'Todos' || doc.type === selectedType;
        const matchesStatus = selectedStatus === 'Todos' || doc.status === selectedStatus;

        return matchesSearch && matchesType && matchesStatus;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'valid':
                return <span className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 rounded text-[10px] font-bold uppercase"><CheckCircle className="h-3 w-3" /> Em Dia</span>;
            case 'expiring':
                return <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded text-[10px] font-bold uppercase"><AlertTriangle className="h-3 w-3" /> Vencendo</span>;
            case 'expired':
                return <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-500 rounded text-[10px] font-bold uppercase"><AlertTriangle className="h-3 w-3" /> Vencido</span>;
            default:
                return null;
        }
    };

    const handleEdit = (doc: CompanyDocument) => {
        setEditingDoc(doc);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingDoc(null);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-kanban-bg overflow-hidden relative">
            <div className="flex items-center justify-between p-6 px-12 border-b border-border/10 bg-card/30 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        Documentação da Empresa
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie alvarás, contratos e certidões com controle de vencimento.</p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Novo Documento
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-auto p-12 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-card p-2 rounded-lg border border-border/20 shadow-sm relative w-full">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto flex-1">
                            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto px-2">
                                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Pesquisar por nome ou tipo..."
                                    className="bg-transparent border-none outline-none text-sm w-full py-1.5 placeholder:text-muted-foreground/50"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="w-px h-6 bg-border/50 hidden sm:block"></div>

                            <div className="flex items-center gap-2 w-full sm:w-auto px-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/50">
                                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Status:</span>
                                <select
                                    className="bg-transparent text-foreground border-none outline-none text-sm py-1.5 cursor-pointer focus:ring-0 max-w-[120px]"
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                >
                                    <option className="bg-background text-foreground" value="Todos">Todos</option>
                                    <option className="bg-background text-foreground" value="valid">Em Dia</option>
                                    <option className="bg-background text-foreground" value="expiring">Vencendo</option>
                                    <option className="bg-background text-foreground" value="expired">Vencido</option>
                                </select>
                            </div>
                            <div className="w-px h-6 bg-border/50 hidden sm:block"></div>

                            <div className="flex items-center gap-2 w-full sm:w-auto px-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/50">
                                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Tipo:</span>
                                <select
                                    className="bg-transparent text-foreground border-none outline-none text-sm py-1.5 cursor-pointer focus:ring-0 max-w-[180px] truncate"
                                    value={selectedType}
                                    onChange={(e) => setSelectedType(e.target.value)}
                                >
                                    <option className="bg-background text-foreground" value="Todos">Todos os Tipos</option>
                                    {documentTypes.map(t => (
                                        <option className="bg-background text-foreground" key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-md border border-border/50 w-full xl:w-auto self-end">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'list'
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }`}
                            >
                                <LayoutList className="h-4 w-4" />
                                Lista
                            </button>
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'calendar'
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }`}
                            >
                                <CalendarIcon className="h-4 w-4" />
                                Calendário
                            </button>
                        </div>
                    </div>

                    {viewMode === 'list' ? (
                        <div className="bg-card rounded-xl border border-border/20 shadow-sm overflow-hidden animate-in fade-in duration-300">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground bg-muted/20 uppercase border-b border-border/20">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold">Documento</th>
                                            <th className="px-6 py-4 font-semibold">Tipo</th>
                                            <th className="px-6 py-4 font-semibold">Status</th>
                                            <th className="px-6 py-4 font-semibold">Vencimento</th>
                                            <th className="px-6 py-4 font-semibold text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDocs.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center justify-center gap-3">
                                                        <FileText className="h-12 w-12 text-muted-foreground/30" />
                                                        <p>Nenhum documento encontrado.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredDocs.map((doc) => (
                                                <tr key={doc.id} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-foreground flex items-center gap-2">
                                                            {doc.title}
                                                        </div>
                                                        {doc.description && (
                                                            <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[250px] line-clamp-1" title={doc.description}>
                                                                {doc.description}
                                                            </div>
                                                        )}
                                                        {doc.link && (
                                                            <a href={doc.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline mt-0.5 block truncate max-w-[200px]" title={doc.link}>
                                                                Abrir Link Original
                                                            </a>
                                                        )}
                                                        {doc.attachments && doc.attachments.length > 0 && (
                                                            <div className="text-[10px] text-primary font-medium mt-1">
                                                                {doc.attachments.length} {doc.attachments.length === 1 ? 'Anexo' : 'Anexos'}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-muted-foreground whitespace-pre-line">{doc.type}</td>
                                                    <td className="px-6 py-4">
                                                        {getStatusBadge(doc.status)}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium">
                                                        <span className={doc.status === 'expired' ? 'text-red-500' : doc.status === 'expiring' ? 'text-yellow-500' : ''}>
                                                            {doc.expirationDate ? format(fixDateToBRT(doc.expirationDate)!, 'dd/MM/yyyy') : '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 flex items-center justify-end gap-2">
                                                        <div className="flex gap-1 items-center">
                                                            {doc.attachments && doc.attachments.length > 0 ? (
                                                                doc.attachments.map(att => (
                                                                    <a
                                                                        key={att.id}
                                                                        href={att.fileData}
                                                                        download={att.fileName}
                                                                        className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                                                                        title={`Baixar ${att.fileName}`}
                                                                    >
                                                                        <FileText className="h-4 w-4" />
                                                                    </a>
                                                                ))
                                                            ) : doc.fileData && (
                                                                <a
                                                                    href={doc.fileData}
                                                                    download={doc.fileName || ("documento-" + doc.title + ".pdf")}
                                                                    className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                                                                    title="Baixar Documento"
                                                                >
                                                                    <FileText className="h-4 w-4" />
                                                                </a>
                                                            )}
                                                        </div>
                                                        {canEdit && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleEdit(doc)}
                                                                    className="p-1.5 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded transition-colors"
                                                                    title="Editar Documento"
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (window.confirm('Mover este documento para a lixeira?')) {
                                                                            trashDocument(doc.id);
                                                                        }
                                                                    }}
                                                                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                                    title="Excluir Documento"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in duration-300">
                            <DocumentCalendarView
                                documents={filteredDocs}
                                onEditDocument={handleEdit}
                            />
                        </div>
                    )}
                </div>
            </div>

            {
                isFormOpen && (
                    <DocumentForm
                        onClose={handleCloseForm}
                        editingDoc={editingDoc || undefined}
                    />
                )
            }
        </div >
    );
};

export default DocumentationPage;
