import { useState } from 'react';
import { useCertificateStore, CapacityCertificate } from '@/store/certificate-store';
import { Plus, Search, FileBadge, Trash2, Edit, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import CertificateForm from '@/components/documentation/CertificateForm';
import { useKanbanStore } from '@/store/kanban-store';

const CapacityCertificatesPage = () => {
    const { certificates, trashCertificate } = useCertificateStore();
    const { cards } = useKanbanStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState<string>('Todos');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCert, setEditingCert] = useState<CapacityCertificate | null>(null);

    const filteredCerts = certificates.filter(cert => {
        if (cert.trashed) return false;

        const matchesSearch = cert.issuingAgency.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cert.suppliedItems.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cert.type.join(' ').toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = selectedType === 'Todos' || cert.type.includes(selectedType as 'Produto' | 'Serviço');

        return matchesSearch && matchesType;
    });

    const handleEdit = (cert: CapacityCertificate) => {
        setEditingCert(cert);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingCert(null);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-kanban-bg overflow-hidden relative">
            <div className="flex items-center justify-between p-6 px-12 border-b border-border/10 bg-card/30 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileBadge className="h-6 w-6 text-primary" />
                        Atestados de Capacidade Técnica
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Acervo técnico, fornecimentos e serviços prestados.</p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors shadow-sm"
                >
                    <Plus className="h-4 w-4" />
                    Novo Atestado
                </button>
            </div>

            <div className="flex-1 overflow-auto p-12 custom-scrollbar">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-card p-2 rounded-lg border border-border/20 shadow-sm relative w-full">
                        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto px-2">
                            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                            <input
                                type="text"
                                placeholder="Pesquisar por órgão, item ou tipo..."
                                className="bg-transparent border-none outline-none text-sm w-full py-1.5 placeholder:text-muted-foreground/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="w-px h-6 bg-border/50 hidden sm:block"></div>
                        <div className="flex items-center gap-2 w-full sm:w-auto px-2 sm:pr-2">
                            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Tipo:</span>
                            <select
                                className="bg-transparent text-foreground border-none outline-none text-sm py-1.5 cursor-pointer focus:ring-0"
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                            >
                                <option className="bg-background text-foreground" value="Todos">Todos os Tipos</option>
                                <option className="bg-background text-foreground" value="Serviço">Serviço Prestado</option>
                                <option className="bg-background text-foreground" value="Produto">Venda de Produto</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-card rounded-xl border border-border/20 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground bg-muted/20 uppercase border-b border-border/20">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Órgão Emissor / Cliente</th>
                                        <th className="px-6 py-4 font-semibold">Objeto Fornecido</th>
                                        <th className="px-6 py-4 font-semibold">Data Exec.</th>
                                        <th className="px-6 py-4 font-semibold">Anexos</th>
                                        <th className="px-6 py-4 font-semibold text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCerts.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <FileBadge className="h-12 w-12 text-muted-foreground/30" />
                                                    <p>Nenhum atestado gravado no acervo.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCerts.map((cert) => {
                                            const linkedCard = cards.find(c => c.id === cert.kunbunCardId);

                                            return (
                                                <tr key={cert.id} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-foreground flex items-center gap-2">
                                                            {cert.issuingAgency}
                                                            {cert.type.map(t => (
                                                                <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold uppercase shrink-0">
                                                                    {t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        {linkedCard && (
                                                            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                                <ExternalLink className="h-3 w-3" />
                                                                Vinc.: {linkedCard.title}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-foreground max-w-[300px] truncate" title={cert.suppliedItems}>
                                                            {cert.suppliedItems}
                                                            {cert.suppliedQuantity && (
                                                                <span className="inline-block ml-2 text-xs font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                                                    Qtd: {cert.suppliedQuantity}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {cert.description && (
                                                            <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[300px] line-clamp-1" title={cert.description}>
                                                                {cert.description}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium whitespace-nowrap">
                                                        {format(new Date(cert.executionDate), 'dd/MM/yyyy')}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                                                            {cert.attachments && cert.attachments.length > 0 ? (
                                                                cert.attachments.map(att => (
                                                                    <a
                                                                        key={att.id}
                                                                        href={att.fileData}
                                                                        download={att.fileName}
                                                                        className="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded font-medium transition-colors flex items-center gap-1"
                                                                        title={`Baixar ${att.fileSlot}: ${att.fileName}`}
                                                                    >
                                                                        {att.fileSlot}
                                                                    </a>
                                                                ))
                                                            ) : (
                                                                <span className="text-[10px] text-muted-foreground italic">Sem comprovantes</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEdit(cert)}
                                                            className="p-1.5 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded transition-colors"
                                                            title="Editar Atestado"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm('Mover este atestado para a lixeira?')) {
                                                                    trashCertificate(cert.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                            title="Excluir Atestado"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {isFormOpen && (
                <CertificateForm
                    onClose={handleCloseForm}
                    editingCert={editingCert || undefined}
                />
            )}
        </div>
    );
};

export default CapacityCertificatesPage;
