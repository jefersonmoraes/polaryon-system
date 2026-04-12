import { useState, useEffect } from 'react';
import { useCertificateStore, CapacityCertificate } from '@/store/certificate-store';
import { Plus, Search, FileBadge, Trash2, Edit, ExternalLink, Download } from 'lucide-react';
import { format } from 'date-fns';
import CertificateForm from '@/components/documentation/CertificateForm';
import { useKanbanStore } from '@/store/kanban-store';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import { openFileInNewTab } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const CapacityCertificatesPage = () => {
    const currentUser = useAuthStore(state => state.currentUser);
    const canEdit = currentUser?.permissions?.canEdit ?? false;
    const certificates = useCertificateStore(state => state.certificates);
    const trashCertificate = useCertificateStore(state => state.trashCertificate);
    const fetchCertificates = useCertificateStore(state => state.fetchCertificates);
    const cards = useKanbanStore(state => state.cards);
    const fetchKanbanData = useKanbanStore(state => state.fetchKanbanData);

    useEffect(() => {
        fetchCertificates();
        // Also fetch kanban to ensure linked cards titles are available
        fetchKanbanData();
    }, [fetchCertificates, fetchKanbanData]);
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

    const handleExportCSV = () => {
        const headers = ['Emissor/Cliente', 'Fornecimento', 'Quantidade', 'Descrição', 'Tipos', 'Data Exec.', 'Possui Anexos?'];

        const rows = filteredCerts.map(cert => [
            `"${cert.issuingAgency.replace(/"/g, '""')}"`,
            `"${cert.suppliedItems.replace(/"/g, '""')}"`,
            cert.suppliedQuantity || '',
            `"${(cert.description || '').replace(/"/g, '""')}"`,
            `"${cert.type.join(', ')}"`,
            format(new Date(cert.executionDate), 'dd/MM/yyyy'),
            cert.attachments.length > 0 ? 'Sim' : 'Não'
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `atestados_capacidade_${format(new Date(), 'dd_MM_yyyy')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-sm font-bold rounded transition-colors shadow-sm"
                    >
                        <Download className="h-4 w-4" /> Exportar CSV
                    </button>
                    {canEdit && (
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            <Plus className="h-4 w-4" />
                            Novo Atestado
                        </button>
                    )}
                </div>
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
                            <Select value={selectedType} onValueChange={setSelectedType}>
                                <SelectTrigger className="bg-transparent border-none shadow-none h-auto py-1 px-1 focus:ring-0 text-sm font-bold w-[140px]">
                                    <SelectValue placeholder="Tipo" />
                                </SelectTrigger>
                                <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                    <SelectItem value="Todos" className="text-xs font-bold">Todos os Tipos</SelectItem>
                                    <SelectItem value="Serviço" className="text-xs font-bold">Serviço Prestado</SelectItem>
                                    <SelectItem value="Produto" className="text-xs font-bold">Venda de Produto</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="bg-card rounded-xl border border-border/20 shadow-sm overflow-hidden bg-card/30">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
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
                                            const linkedCard = cards.find(c => c.id === cert.kanbanCardId);

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
                                                                    <div key={att.id} className="flex items-center gap-1 group">
                                                                        <button
                                                                            onClick={async () => {
                                                                                try {
                                                                                    const response = await api.get(`/certificates/attachment/${att.id}`);
                                                                                    if (response.data && response.data.fileData) {
                                                                                        const link = document.createElement('a');
                                                                                        link.href = response.data.fileData;
                                                                                        link.download = att.fileName || 'arquivo';
                                                                                        document.body.appendChild(link);
                                                                                        link.click();
                                                                                        document.body.removeChild(link);
                                                                                    } else {
                                                                                        alert('Erro: Arquivo não encontrado no servidor.');
                                                                                    }
                                                                                } catch (e) {
                                                                                    console.error('Failed to download attachment', e);
                                                                                    alert('Ocorreu um erro ao baixar o anexo.');
                                                                                }
                                                                            }}
                                                                            className="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded font-medium transition-colors flex items-center gap-1 cursor-pointer"
                                                                            title={`Baixar ${att.fileSlot}: ${att.fileName}`}
                                                                        >
                                                                            <Download className="h-3 w-3" />
                                                                            {att.fileSlot}
                                                                        </button>
                                                                        <button
                                                                            onClick={async () => {
                                                                                try {
                                                                                    const response = await api.get(`/certificates/attachment/${att.id}`);
                                                                                    if (response.data && response.data.fileData) {
                                                                                        openFileInNewTab(response.data.fileData, att.fileName);
                                                                                    } else {
                                                                                        alert('Erro: Arquivo não encontrado no servidor.');
                                                                                    }
                                                                                } catch (e) {
                                                                                    console.error('Failed to open attachment', e);
                                                                                }
                                                                            }}
                                                                            className="p-1 px-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded text-[10px] transition-colors"
                                                                            title="Abrir em Nova Aba"
                                                                        >
                                                                            <ExternalLink className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <span className="text-[10px] text-muted-foreground italic">Sem comprovantes</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {canEdit && (
                                                                <>
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
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4 p-4">
                            {filteredCerts.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                    <FileBadge className="h-10 w-10 mx-auto opacity-20 mb-2" />
                                    <p>Nenhum atestado encontrado.</p>
                                </div>
                            ) : (
                                filteredCerts.map((cert) => {
                                    const linkedCard = cards.find(c => c.id === cert.kanbanCardId);
                                    return (
                                        <div key={cert.id} className="bg-background border border-border/50 rounded-lg p-4 shadow-sm space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex flex-wrap gap-1">
                                                        {cert.type.map(t => (
                                                            <span key={t} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-[4px] text-[10px] font-bold uppercase">
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <h3 className="font-bold text-foreground leading-snug">{cert.issuingAgency}</h3>
                                                </div>
                                                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded">
                                                    {format(new Date(cert.executionDate), 'dd/MM/yyyy')}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="text-xs text-foreground bg-secondary/30 p-2 rounded border border-border/10">
                                                    <span className="text-muted-foreground font-medium mr-1 uppercase text-[9px]">Objeto:</span>
                                                    {cert.suppliedItems}
                                                    {cert.suppliedQuantity && (
                                                        <span className="ml-1 font-bold text-primary">(Qtd: {cert.suppliedQuantity})</span>
                                                    )}
                                                </div>
                                                
                                                {linkedCard && (
                                                    <div className="text-[10px] text-primary bg-primary/5 p-1.5 rounded flex items-center gap-1 border border-primary/10">
                                                        <ExternalLink className="h-3 w-3" />
                                                        <span className="truncate">Vinc.: {linkedCard.title}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-border/10 gap-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {cert.attachments.length > 0 ? (
                                                        cert.attachments.map(att => (
                                                            <button 
                                                                key={att.id}
                                                                onClick={() => { /* same logic as above */ }}
                                                                className="text-[9px] px-2 py-1 bg-blue-500/10 text-blue-500 rounded font-bold uppercase"
                                                            >
                                                                {att.fileSlot}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <span className="text-[9px] text-muted-foreground uppercase">Sem anexos</span>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    {canEdit && (
                                                        <>
                                                            <button onClick={() => handleEdit(cert)} className="p-2 text-muted-foreground hover:text-primary active:bg-primary/10 rounded-full transition-colors">
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button onClick={() => { if(window.confirm('Excluir?')) trashCertificate(cert.id); }} className="p-2 text-muted-foreground hover:text-red-500 active:bg-red-500/10 rounded-full transition-colors">
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
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
