import { useState, useEffect } from 'react';
import { useEssentialDocumentStore, EssentialDocumentModel } from '@/store/essential-document-store';
import { Plus, Search, FileText, Trash2, Edit } from 'lucide-react';
import EssentialDocumentModelForm from '@/components/documentation/EssentialDocumentModelForm';
import { useAuthStore } from '@/store/auth-store';
import { openFileInNewTab } from '@/lib/utils';

const EssentialDocumentModelsPage = () => {
    const currentUser = useAuthStore(state => state.currentUser);
    const canEdit = currentUser?.permissions?.canEdit ?? false;
    const models = useEssentialDocumentStore(state => state.models);
    const trashModel = useEssentialDocumentStore(state => state.trashModel);
    const initializeDefaultModels = useEssentialDocumentStore(state => state.initializeDefaultModels);
    const fetchModels = useEssentialDocumentStore(state => state.fetchModels);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingModel, setEditingModel] = useState<EssentialDocumentModel | null>(null);

    useEffect(() => {
        fetchModels();
        initializeDefaultModels();
    }, [fetchModels, initializeDefaultModels]);

    const filteredModels = models.filter(model => {
        if (model.trashed) return false;

        const searchLower = searchQuery.toLowerCase();
        return model.title.toLowerCase().includes(searchLower) ||
            model.description?.toLowerCase().includes(searchLower);
    });

    const handleEdit = (model: EssentialDocumentModel) => {
        setEditingModel(model);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingModel(null);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-kanban-bg overflow-hidden relative">
            <div className="flex items-center justify-between p-6 px-12 border-b border-border/10 bg-card/30 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        Modelos de Documentos Essenciais
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie e acesse modelos recorrentes para licitações e contratos.</p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Novo Modelo
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
                                    placeholder="Pesquisar modelos por título ou descrição..."
                                    className="bg-transparent border-none outline-none text-sm w-full py-1.5 placeholder:text-muted-foreground/50"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-card rounded-xl border border-border/20 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground bg-muted/20 uppercase border-b border-border/20">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold w-[40%]">Título</th>
                                        <th className="px-6 py-4 font-semibold w-[40%]">Descrição</th>
                                        <th className="px-6 py-4 font-semibold w-[10%] text-center">Anexos</th>
                                        <th className="px-6 py-4 font-semibold w-[10%] text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredModels.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <FileText className="h-12 w-12 text-muted-foreground/30" />
                                                    <p>Nenhum modelo de documento encontrado.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredModels.map((model) => (
                                            <tr key={model.id} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                                        {model.title}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground whitespace-pre-wrap">
                                                    <div className="line-clamp-2" title={model.description || ''}>
                                                        {model.description || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                                        {model.attachments?.length || 0}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 flex items-center justify-end gap-2">
                                                    <div className="flex gap-1 items-center">
                                                        {model.attachments && model.attachments.length > 0 && (
                                                            model.attachments.map(att => (
                                                                <button
                                                                    key={att.id}
                                                                    onClick={() => openFileInNewTab(att.fileData, att.fileName)}
                                                                    className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                                                                    title={`Abrir ${att.fileName}`}
                                                                >
                                                                    <FileText className="h-4 w-4" />
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                    {canEdit && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(model)}
                                                                className="p-1.5 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded transition-colors"
                                                                title="Editar Modelo"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm('Mover este modelo para a lixeira?')) {
                                                                        trashModel(model.id);
                                                                    }
                                                                }}
                                                                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                                title="Excluir Modelo"
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
                </div>
            </div>

            {isFormOpen && (
                <EssentialDocumentModelForm
                    onClose={handleCloseForm}
                    editingModel={editingModel || undefined}
                />
            )}
        </div>
    );
};

export default EssentialDocumentModelsPage;
