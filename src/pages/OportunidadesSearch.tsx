import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Search, Calendar, MapPin, Building2, ExternalLink, Filter, Loader2, AlertCircle, ChevronRight, FileText, X, DollarSign, Briefcase, KanbanSquare, Download, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogClose, DialogHeader } from '@/components/ui/dialog';
import { useLocation } from 'react-router-dom';
import api from '@/lib/api';
import { useKanbanStore } from '@/store/kanban-store';
import { toast } from 'sonner';

interface PncpItem {
    id: string;
    title: string;
    description: string;
    item_url: string;
    orgao_nome: string;
    orgao_cnpj: string;
    esfera_nome: string;
    poder_nome: string;
    municipio_nome: string;
    uf: string;
    situacao_nome: string;
    data_inicio_vigencia?: string;
    data_fim_vigencia?: string;
    data_assinatura?: string;
    valor_global?: number;
    valorTotalEstimado?: number;
    modalidade_licitacao_nome: string;
    data_publicacao_pncp?: string;
    data_atualizacao_pncp?: string;
    data_inicio_proposta?: string; // Gov endpoint uses this for Propostas
    data_encerramento_proposta?: string;
    situacao_compra_nome: string;
    unidade_nome?: string;
    unidade_codigo?: string;
    amparo_legal_nome?: string;
    srp?: boolean;
    tipo_instrumento_convocacao_nome?: string;
    numero_controle_pncp?: string;
}

const ESTADOS_BR = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const ESTADOS_MAP: Record<string, string> = {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
    'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
    'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
    'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
    'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
    'SE': 'Sergipe', 'TO': 'Tocantins'
};

const ProposalDates = memo(({ item }: { item: PncpItem }) => {
    const [dates, setDates] = useState<{ inicio?: string; fim?: string; loading: boolean }>({ loading: true });

    useEffect(() => {
        let isMounted = true;
        const fetchDates = async () => {
            const ano = (item as any).ano_compra || (item as any).ano;
            const seq = (item as any).numero_compra || (item as any).numero_sequencial;
            if (!item.orgao_cnpj || !ano || !seq) {
                if (isMounted) setDates({ loading: false });
                return;
            }
            try {
                // A Rota /pncp/v1 foi desativada e redireciona (301) sem CORS. A Rota /consulta/v1/ é a oficial aberta.
                const res = await fetch(`https://pncp.gov.br/api/consulta/v1/orgaos/${item.orgao_cnpj}/compras/${ano}/${seq}`);
                if (!res.ok) throw new Error();
                const detail = await res.json();
                if (isMounted) {
                    setDates({
                        inicio: detail.dataRecebimentoProposta || detail.dataAberturaProposta || detail.dataHoraRegistroOcorrencia,
                        fim: detail.dataFimRecebimentoProposta || detail.dataEncerramentoProposta,
                        loading: false
                    });
                }
            } catch (e) {
                if (isMounted) setDates({ loading: false });
            }
        };
        fetchDates();
        return () => { isMounted = false; };
    }, [item.orgao_cnpj, item.numero_controle_pncp]);

    if (dates.loading) {
        return (
            <>
                <td className="px-4 py-3.5 align-top text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin opacity-50 block mx-auto" /></td>
                <td className="px-4 py-3.5 align-top text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin opacity-50 block mx-auto" /></td>
            </>
        );
    }

    return (
        <>
            <td className="px-4 py-3.5 align-top text-muted-foreground font-medium text-[11px]">
                {dates.inicio ? new Date(dates.inicio).toLocaleDateString('pt-BR') : '-'}
            </td>
            <td className="px-4 py-3.5 align-top text-[11px] font-medium text-destructive">
                {dates.fim ? new Date(dates.fim).toLocaleDateString('pt-BR') : '-'}
            </td>
        </>
    );
});

export default function OportunidadesSearch() {
    const location = useLocation();
    const [keyword, setKeyword] = useState(location.state?.openPncpId || '');
    const [statusFilter, setStatusFilter] = useState('1'); // Default = A Receber Propostas
    const [ufFilter, setUfFilter] = useState('');
    const [instrumentoFilter, setInstrumentoFilter] = useState('edital');
    const [esferaFilter, setEsferaFilter] = useState('');
    const [ordenacaoFilter, setOrdenacaoFilter] = useState('-data_publicacao_pncp');
    const [orgaoFilter, setOrgaoFilter] = useState('');
    const [modalidadeFilter, setModalidadeFilter] = useState('');
    const [municipioFilter, setMunicipioFilter] = useState('');
    const [poderFilter, setPoderFilter] = useState('');
    const [fonteOrcamentoFilter, setFonteOrcamentoFilter] = useState('');
    const [conteudoNacionalFilter, setConteudoNacionalFilter] = useState('');
    const [margemPreferenciaFilter, setMargemPreferenciaFilter] = useState('');
    const [unidadeFilter, setUnidadeFilter] = useState('');
    const [dataInicialFilter, setDataInicialFilter] = useState('');
    const [dataFinalFilter, setDataFinalFilter] = useState('');

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    const handleClearFilters = useCallback(() => {
        setKeyword('');
        setUfFilter('');
        setOrgaoFilter('');
        setInstrumentoFilter('');
        setEsferaFilter('');
        setPoderFilter('');
        setConteudoNacionalFilter('');
        setMargemPreferenciaFilter('');
        setUnidadeFilter('');
        setStatusFilter('1');
        setDataInicialFilter('');
        setDataFinalFilter('');
        setPage(1);
    }, []);

    const [page, setPage] = useState(1);
    const [pageInput, setPageInput] = useState('1'); // Para digitação manual no Pagination footer
    const [results, setResults] = useState<PncpItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [totalResults, setTotalResults] = useState(0);

    const [selectedItem, setSelectedItem] = useState<PncpItem | null>(null);
    const [selectedItemFiles, setSelectedItemFiles] = useState<any[]>([]);
    const [selectedFilesToExport, setSelectedFilesToExport] = useState<any[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);

    const getOfficialLink = useCallback((item: PncpItem) => {
        if (!item?.item_url) return '#';
        if (item.item_url.startsWith('http')) return item.item_url;
        return `https://pncp.gov.br${item.item_url.replace('/compras/', '/app/editais/')}`;
    }, []);

    useEffect(() => {
        if (!selectedItem) {
            setSelectedItemFiles([]);
            return;
        }
        const fetchFiles = async () => {
            setLoadingFiles(true);
            try {
                const ano = (selectedItem as any).ano_compra || (selectedItem as any).ano;
                const seq = (selectedItem as any).numero_compra || (selectedItem as any).numero_sequencial;
                if (!selectedItem.orgao_cnpj || !ano || !seq) {
                    setSelectedItemFiles([]);
                    return;
                }
                const res = await fetch(`https://pncp.gov.br/api/pncp/v1/orgaos/${selectedItem.orgao_cnpj}/compras/${ano}/${seq}/arquivos`);
                if (res.ok) {
                    const data = await res.json();
                    setSelectedItemFiles(data);
                    setSelectedFilesToExport(data); // Vêm todos pré-selecionados para export
                }
            } catch (e) {
                console.error("Failed to fetch files", e);
            } finally {
                setLoadingFiles(false);
            }
        };
        fetchFiles();
    }, [selectedItem]);

    // --- Kunbun Export States ---
    const folders = useKanbanStore(state => state?.folders) || [];
    const boards = useKanbanStore(state => state?.boards) || [];
    const lists = useKanbanStore(state => state?.lists) || [];
    const allMembers = useKanbanStore(state => state?.members);
    const currentUser = useMemo(() => (allMembers || []).filter(m => 
        m &&
        !(m.email || '').toLowerCase().includes('jjcorporation') && 
        !(m.name || '').toLowerCase().includes('jjcorporation')
    )[0] || null, [allMembers]);
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [exportFolderId, setExportFolderId] = useState('');
    const [exportBoardId, setExportBoardId] = useState('');
    const [exportListId, setExportListId] = useState('');

    const handleExportToKunbun = () => {
        if (!exportListId || !selectedItem) {
            toast.error("Por favor, selecione uma pasta, quadro e lista de destino.");
            return;
        }

        const board = boards.find(b => b.id === exportBoardId);
        if (!board) return;

        // Formatação Rica do Markdown
        const descriptionMD = `
**[GOV.BR] Oportunidade PNCP mapeada pelo Polaryon**
---
**Órgão Licitante:** ${selectedItem.orgao_nome}
**CNPJ:** ${selectedItem.orgao_cnpj}
**Unidade Compradora:** ${selectedItem.unidade_nome || 'N/A'} (Cód: ${selectedItem.unidade_codigo || '-'})
**Localidade:** ${selectedItem.municipio_nome} - ${selectedItem.uf}
**Modalidade:** ${selectedItem.modalidade_licitacao_nome}
**Instrumento:** ${selectedItem.tipo_instrumento_convocacao_nome || '-'}
**SRP (Registro de Preços):** ${selectedItem.srp ? 'Sim' : 'Não'}
**Amparo Legal:** ${selectedItem.amparo_legal_nome || 'N/A'}
**Valor Estimado:** ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedItem.valorTotalEstimado || selectedItem.valor_global || 0)}
**Datas do Edital:** Publicação PNCP (${selectedItem.data_publicacao_pncp ? new Date(selectedItem.data_publicacao_pncp).toLocaleDateString('pt-BR') : '-'}) • **Atualização:** ${selectedItem.data_atualizacao_pncp ? new Date(selectedItem.data_atualizacao_pncp).toLocaleDateString('pt-BR') : '-'}
**Encerramento de Propostas:** ${selectedItem.data_fim_vigencia ? new Date(selectedItem.data_fim_vigencia).toLocaleDateString('pt-BR') : '-'}

### Objeto:
${selectedItem.description || selectedItem.title}

### Arquivos Anexos:
${selectedItemFiles.length > 0 ? selectedItemFiles.map(f => `- [${f.titulo} (${f.tipoDocumentoNome})](${f.url})`).join('\n') : '*Nenhum arquivo capturado automaticamente.*'}

[🔗 Acessar Edital Oficial Completo no PNCP](${getOfficialLink(selectedItem)})
        `.trim();

        const cardParams = {
            title: selectedItem.title,
            summary: "Oportunidade importada do GovBr",
            description: descriptionMD,
            listId: exportListId,
            position: 0,
            labels: [],
            assignee: null,
            completed: false,
            archived: false,
            trashed: false,
        };

        // Inject Attachments (Selected Files + Link to PNCP)
        const cardAttachments: any[] = [];

        cardAttachments.push({
            id: crypto.randomUUID(),
            name: "Acesso Oficial PNCP - " + selectedItem.title,
            url: getOfficialLink(selectedItem),
            type: "url",
            addedAt: new Date().toISOString()
        });

        for (const file of selectedFilesToExport) {
            cardAttachments.push({
                id: crypto.randomUUID(),
                name: file.titulo || file.tipoDocumentoNome,
                url: file.url,
                type: "pdf", // Fallback type
                addedAt: new Date().toISOString()
            });
        }

        // Create Full Card Object
        const newCardData = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            comments: [],
            attachments: cardAttachments,
            checklist: [],
            timeEntries: [],
            customLink: getOfficialLink(selectedItem),
            pncpId: selectedItem.numero_controle_pncp || selectedItem.orgao_cnpj,
            ...cardParams
        };

        // Inject Card Optimistically properly via Zustand SetState to trigger LocalStorage Persist
        useKanbanStore.setState(state => ({
            cards: [...state.cards, newCardData]
        }));
        api.post('/kanban/cards', newCardData).catch(e => console.error("Export Kanban Sync failed", e));

        toast.success("Oportunidade exportada! Cartão criado no Kunbun.");
        setIsExportDialogOpen(false);
    };

    const fetchOportunidades = useCallback(async (currentPage = 1) => {
        setLoading(true);
        setError('');
        try {
            // PNCP API hard-caps /search/ results to 50 items.
            // To fulfill the 100 items requirement, we must double-fetch pages concurrently.
            const pncpPage1 = (currentPage * 2) - 1;
            const pncpPage2 = currentPage * 2;

            const makeUrl = (p: number) => {
                let url = `https://pncp.gov.br/api/search/?tamanho_pagina=50&pagina=${p}`;

                // Smart Keyword Injection: Append State Name & Modalidade to query to force API to return target items
                let searchQuery = keyword.trim();
                const ufName = ufFilter ? (ESTADOS_MAP[ufFilter] || ufFilter) : '';

                if (ufName) searchQuery = searchQuery ? `${searchQuery} ${ufName}` : ufName;
                if (modalidadeFilter) searchQuery = searchQuery ? `${searchQuery} ${modalidadeFilter}` : modalidadeFilter;

                if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;

                // PNCP fails if status is empty. If 'Todos' was selected, fetch all standard ones
                url += `&status=${statusFilter || '1,2,3,4'}`;

                // NEW PNCP RULE: tipos_documento is now REQUIRED by the Federal API. Cannot be empty.
                const fallbackDocumentos = 'edital,aviso_contratacao_direta,ata,contrato';
                url += `&tipos_documento=${instrumentoFilter || fallbackDocumentos}`;

                if (esferaFilter) url += `&esfera=${esferaFilter}`;
                if (dataInicialFilter) url += `&dataInicial=${dataInicialFilter.replace(/-/g, '')}`;
                if (dataFinalFilter) url += `&dataFinal=${dataFinalFilter.replace(/-/g, '')}`;

                // Force sorting on API (though Client side handles the rest)
                if (ordenacaoFilter) url += `&ordenacao=${ordenacaoFilter}`;
                return url;
            };

            const [res1, res2] = await Promise.all([
                fetch(makeUrl(pncpPage1)).catch(() => ({ ok: false, json: async () => ({ items: [] }) } as any)),
                fetch(makeUrl(pncpPage2)).catch(() => ({ ok: false, json: async () => ({ items: [] }) } as any))
            ]);

            if (!res1.ok && !res2.ok) throw new Error('Falha ao conectar na base de dados nacional.');

            let data1 = { items: [], total: 0 };
            let data2 = { items: [] };

            try { if (res1.ok) data1 = await res1.json(); } catch (e) { console.warn("Parse Error Page 1"); }
            try { if (res2.ok) data2 = await res2.json(); } catch (e) { console.warn("Parse Error Page 2"); }

            let items = [...(data1?.items || []), ...(data2?.items || [])];

            // --- Client-Side "Mega Filters" Fallback ---
            // A API PNCP /search/ não suporta todos os filtros avançados na URL macro (ex: Fonte Orçamentária, Conteúdo Nacional, Esfera)
            // Filtraremos em memória (local runtime) os itens retornados no lote de 100 para simular o "Siga Pregão".

            if (ufFilter) items = items.filter((i: PncpItem) => i?.uf === ufFilter);
            if (esferaFilter) items = items.filter((i: any) => i?.esfera_id === esferaFilter);
            if (orgaoFilter) items = items.filter((i: PncpItem) => (i?.orgao_nome?.toLowerCase() || '').includes(orgaoFilter.toLowerCase()) || (i?.orgao_cnpj || '').includes(orgaoFilter));
            if (modalidadeFilter) items = items.filter((i: PncpItem) => (i?.modalidade_licitacao_nome?.toLowerCase() || '').includes(modalidadeFilter.toLowerCase()));
            if (municipioFilter) items = items.filter((i: PncpItem) => (i?.municipio_nome?.toLowerCase() || '').includes(municipioFilter.toLowerCase()));
            if (poderFilter) items = items.filter((i: PncpItem) => (i?.poder_nome?.toLowerCase() || '') === poderFilter.toLowerCase());

            // Itens extras pedidos (Fonte, Conteúdo Nac., Unidade, Margem) mapeados a partir do payload Real do Gov:
            if (unidadeFilter) items = items.filter((i: any) => (i?.unidade_nome?.toLowerCase() || '').includes(unidadeFilter.toLowerCase()) || (i?.unidade_codigo || '').includes(unidadeFilter));
            if (fonteOrcamentoFilter) items = items.filter((i: any) => (i?.fonte_orcamentaria?.toLowerCase() || '').includes(fonteOrcamentoFilter.toLowerCase()));
            if (conteudoNacionalFilter) items = items.filter((i: any) => {
                if (conteudoNacionalFilter === 'Sim') return i?.exigencia_conteudo_nacional === true;
                if (conteudoNacionalFilter === 'Não') return i?.exigencia_conteudo_nacional === false;
                return true;
            });
            if (margemPreferenciaFilter) items = items.filter((i: any) => (i?.tipo_margem_preferencia_nome?.toLowerCase() || '').includes(margemPreferenciaFilter.toLowerCase()));

            // Client-Side Ordering directly on runtime memory buffer
            if (ordenacaoFilter === '-data_publicacao_pncp') {
                items.sort((a, b) => new Date(b.data_publicacao_pncp || 0).getTime() - new Date(a.data_publicacao_pncp || 0).getTime());
            } else if (ordenacaoFilter === 'data_publicacao_pncp') {
                items.sort((a, b) => new Date(a.data_publicacao_pncp || 0).getTime() - new Date(b.data_publicacao_pncp || 0).getTime());
            }

            setResults(items);
            setTotalResults(data1?.total || 0);
            setPage(currentPage);
            setPageInput(currentPage.toString());
        } catch (err: any) {
            setError(err.message || 'Erro inesperado na busca.');
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [
        keyword, ufFilter, modalidadeFilter, statusFilter, instrumentoFilter,
        esferaFilter, dataInicialFilter, dataFinalFilter, ordenacaoFilter,
        orgaoFilter, municipioFilter, poderFilter, unidadeFilter,
        fonteOrcamentoFilter, conteudoNacionalFilter, margemPreferenciaFilter
    ]);

    // Auto-load abertas recentes
    useEffect(() => {
        fetchOportunidades(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        fetchOportunidades(1);
    }, [fetchOportunidades]);

    const formatDate = useCallback((dateString?: string, showTime = false) => {
        if (!dateString) return '-';
        try {
            const d = new Date(dateString);
            return showTime ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString('pt-BR');
        } catch {
            return dateString;
        }
    }, []);

    const getStatusStyle = useCallback((situacao: string) => {
        const lower = situacao.toLowerCase();
        if (lower.includes('divulgada')) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        if (lower.includes('suspensa')) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
        if (lower.includes('encerrada') || lower.includes('revogada')) return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
        return 'bg-secondary text-foreground border-border';
    }, []);

    const formatCurrency = useCallback((val?: number) => {
        if (val === undefined || val === null) return 'N/I';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    }, []);

    const handlePageInputSubmit = () => {
        let p = parseInt(pageInput);
        const maxPages = Math.min(Math.ceil(totalResults / 100), 100);
        if (isNaN(p) || p < 1) p = 1;
        if (maxPages > 0 && p > maxPages) p = maxPages;
        setPageInput(p.toString());
        if (p !== page) fetchOportunidades(p);
    };

    const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handlePageInputSubmit();
    };

    const totalPages = Math.min(Math.ceil(totalResults / 100), 100);

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-background text-foreground min-h-full">

            {/* Action Bar & Filters (Sticky/Fixed Header) */}
            <div className="bg-card border-b border-border shrink-0 z-10 shadow-sm">
                <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Target className="h-5 w-5 text-primary" />
                        <h1 className="text-xl font-bold tracking-tight">Explorador PNCP</h1>
                    </div>

                    <form onSubmit={handleSearch} className="flex flex-col gap-3">
                        {/* Top Line: Search & Main Filters */}
                        <div className="flex flex-col md:flex-row gap-2">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Buscar objeto, nº do edital ou CNPJ..."
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    className="w-full h-10 bg-background border border-border rounded-md pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                className={`h-10 px-4 text-sm font-medium rounded-md border transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap ${isAdvancedOpen ? 'bg-secondary text-secondary-foreground border-border' : 'bg-background hover:bg-secondary border-border'}`}
                            >
                                <Filter className="h-4 w-4" />
                                Filtros Avançados
                            </button>
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="h-10 px-4 text-sm font-medium rounded-md border border-border bg-background hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                                title="Restaurar filtro padrão de lote inicial"
                            >
                                <X className="h-4 w-4" />
                                Limpar Filtros
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="h-10 px-6 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                Pesquisar
                            </button>
                        </div>

                        {/* Expandable Advanced Filters Grid */}
                        {isAdvancedOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-2 pb-1 border-t border-border/50 mt-1"
                            >
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Instrumento</label>
                                    <select value={instrumentoFilter} onChange={(e) => setInstrumentoFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary">
                                        <option value="">Todos Documentos</option>
                                        <option value="edital">Editais / Avisos de Contratação</option>
                                        <option value="ata">Atas de Registro de Preços</option>
                                        <option value="contrato">Contratos</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Status</label>
                                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary">
                                        <option value="">Todos os Status</option>
                                        <option value="1">A Receber / Recebendo Proposta</option>
                                        <option value="2">Em Julgamento / Homologadas</option>
                                        <option value="3">Encerradas / Anuladas</option>
                                        <option value="4">Suspensas</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">UF / Estado</label>
                                    <select value={ufFilter} onChange={(e) => setUfFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary">
                                        <option value="">Qualquer UF</option>
                                        {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Esferas</label>
                                    <select value={esferaFilter} onChange={(e) => setEsferaFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary">
                                        <option value="">Todas Esferas</option>
                                        <option value="F">Federal</option>
                                        <option value="E">Estadual</option>
                                        <option value="M">Municipal</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Poderes</label>
                                    <select value={poderFilter} onChange={(e) => setPoderFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary">
                                        <option value="">Todos</option>
                                        <option value="Executivo">Executivo</option>
                                        <option value="Legislativo">Legislativo</option>
                                        <option value="Judiciário">Judiciário</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Organização / Órgão</label>
                                    <input type="text" placeholder="Nome ou CNPJ..." value={orgaoFilter} onChange={(e) => setOrgaoFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Modalidade Licit.</label>
                                    <select value={modalidadeFilter} onChange={(e) => setModalidadeFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary">
                                        <option value="">Todas</option>
                                        <option value="Pregão">Pregão Eletrônico/Presencial</option>
                                        <option value="Dispensa">Dispensa de Licitação</option>
                                        <option value="Concorrência">Concorrência</option>
                                        <option value="Inexigibilidade">Inexigibilidade</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Municípios</label>
                                    <input type="text" placeholder="Ex: São Paulo" value={municipioFilter} onChange={(e) => setMunicipioFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Ordenação</label>
                                    <select value={ordenacaoFilter} onChange={(e) => setOrdenacaoFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary">
                                        <option value="-data_publicacao_pncp">Mais Recente Primeiro</option>
                                        <option value="data_publicacao_pncp">Mais Antigo Primeiro</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Unid. de Compra</label>
                                    <input type="text" placeholder="UASG / Unidade" value={unidadeFilter} onChange={(e) => setUnidadeFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Fonte Orçamentária</label>
                                    <input type="text" placeholder="Código Fon." value={fonteOrcamentoFilter} onChange={(e) => setFonteOrcamentoFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Cont. Nacional</label>
                                    <select value={conteudoNacionalFilter} onChange={(e) => setConteudoNacionalFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary">
                                        <option value="">Qualquer Exigência</option>
                                        <option value="Sim">Exige (Sim)</option>
                                        <option value="Não">Não Exige</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Margens Prefe.</label>
                                    <select value={margemPreferenciaFilter} onChange={(e) => setMargemPreferenciaFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary">
                                        <option value="">Todas</option>
                                        <option value="Normal">Normal</option>
                                        <option value="ME">Exclusiva ME/EPP</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Período (Início)</label>
                                    <input type="date" value={dataInicialFilter} onChange={(e) => setDataInicialFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Período (Fim)</label>
                                    <input type="date" value={dataFinalFilter} onChange={(e) => setDataFinalFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                            </motion.div>
                        )}
                    </form>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="m-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-md flex items-center gap-2 text-sm shrink-0">
                    <AlertCircle className="h-4 w-4" /> {error}
                </div>
            )}

            {/* Main Content Area - Table Layout */}
            <div className="flex-1 overflow-auto bg-muted/20 relative">
                {loading && results.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-20">
                        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                        <p className="text-sm font-medium text-muted-foreground animate-pulse">Consultando Diário Oficial / PNCP...</p>
                    </div>
                ) : results.length === 0 ? (
                    <div className="max-w-md mx-auto mt-20 p-8 text-center bg-background rounded-xl border border-border shadow-sm">
                        <Filter className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <h3 className="text-base font-semibold mb-1">Nenhuma Licitação Encontrada</h3>
                        <p className="text-sm text-muted-foreground">O filtro selecionado não retornou resultados no lote atual. Tente remover filtros ou usar sinônimos.</p>
                    </div>
                ) : (
                    <div className="w-full min-w-[900px]">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-muted text-muted-foreground sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 font-medium w-32">Status</th>
                                    <th className="px-4 py-3 font-medium w-40">Publicação</th>
                                    <th className="px-4 py-3 font-medium w-32">Início Recepção</th>
                                    <th className="px-4 py-3 font-medium w-32">Fim Recepção</th>
                                    <th className="px-4 py-3 font-medium">Órgão / Descrição Sintética</th>
                                    <th className="px-4 py-3 font-medium w-32">Modalidade</th>
                                    <th className="px-4 py-3 font-medium w-24">UF</th>
                                    <th className="px-4 py-3 font-medium w-20">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-background">
                                {results.map((item, index) => (
                                    <tr
                                        key={item.id || index}
                                        onClick={() => setSelectedItem(item)}
                                        className="hover:bg-muted/50 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-4 py-3.5 align-top">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold border truncate max-w-[120px] ${getStatusStyle(item.situacao_nome)}`}>
                                                {item.situacao_nome}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 align-top text-muted-foreground">
                                            {formatDate(item.data_publicacao_pncp)}
                                        </td>
                                        <ProposalDates item={item} />
                                        <td className="px-4 py-2.5 whitespace-normal">
                                            <div className="flex flex-col gap-1 max-w-[500px]">
                                                <span className="font-semibold text-foreground text-xs leading-tight tracking-tight uppercase">
                                                    {item.orgao_nome}
                                                </span>
                                                <span className="text-muted-foreground text-xs line-clamp-2 leading-relaxed" title={item.description}>
                                                    {item.description || item.title}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 align-top">
                                            <span className="text-xs bg-secondary px-2 py-1 rounded text-secondary-foreground">
                                                {item.modalidade_licitacao_nome}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 align-top">
                                            <div className="flex items-center gap-1 text-xs">
                                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                                <span className="font-medium">{item.uf || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 align-top text-right">
                                            <div className="h-7 w-7 rounded bg-secondary text-muted-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors ml-auto">
                                                <ChevronRight className="h-4 w-4" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Status Bar Footer w/ Pagination */}
            <div className="h-14 shrink-0 bg-muted/50 border-t border-border flex items-center justify-between px-6 text-xs text-muted-foreground shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-4">
                    <span title={`Base bruta do governo: ${totalResults.toLocaleString('pt-BR')}`}>
                        Mostrando <strong className="text-foreground">{results.length}</strong> encontrados nesta página de lote.
                    </span>
                </div>

                <div className="flex items-center gap-2 bg-background border border-border p-1 rounded-md shadow-sm">
                    {/* First Page */}
                    <button
                        title="Ir para Primeira Página"
                        onClick={() => fetchOportunidades(1)}
                        disabled={page === 1 || loading}
                        className="px-2 py-1.5 text-xs font-bold rounded-sm hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-foreground"
                    >
                        &laquo;
                    </button>
                    {/* Previous Page */}
                    <button
                        onClick={() => fetchOportunidades(page - 1)}
                        disabled={page === 1 || loading}
                        className="px-3 py-1.5 text-xs font-medium rounded-sm hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                        Anterior
                    </button>

                    <div className="flex items-center gap-1.5 px-2">
                        <span>Pág</span>
                        <input
                            type="text"
                            className="w-12 h-7 text-center text-xs font-bold bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                            value={pageInput}
                            onChange={(e) => setPageInput(e.target.value)}
                            onFocus={() => setPageInput('')}
                            onBlur={handlePageInputSubmit}
                            onKeyDown={handlePageInputKeyDown}
                            disabled={loading}
                        />
                        <span>de {totalPages > 0 ? totalPages : 1}</span>
                    </div>

                    {/* Next Page */}
                    <button
                        onClick={() => fetchOportunidades(page + 1)}
                        disabled={page >= totalPages || loading}
                        className="px-3 py-1.5 text-xs font-medium rounded-sm hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                        Próxima
                    </button>
                    {/* Last Page */}
                    <button
                        title="Ir para Última Página"
                        onClick={() => fetchOportunidades(totalPages)}
                        disabled={page >= totalPages || loading}
                        className="px-2 py-1.5 text-xs font-bold rounded-sm hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-foreground"
                    >
                        &raquo;
                    </button>
                </div>
            </div>

            {/* Side Panel (Modal) for Details */}
            <AnimatePresence>
                {selectedItem && (
                    <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
                        <DialogContent className="max-w-5xl w-[90vw] max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-background shadow-2xl z-[100] sm:rounded-xl">
                            <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/30 sticky top-0 z-10 backdrop-blur-md">
                                <div className="flex items-start justify-between gap-4">
                                    <DialogTitle className="text-xl font-bold leading-tight pt-1">
                                        {selectedItem.title}
                                    </DialogTitle>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <span className={`px-2 py-0.5 rounded text-[11px] uppercase font-bold border ${getStatusStyle(selectedItem.situacao_nome)}`}>
                                        {selectedItem.situacao_nome}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[11px] uppercase border border-border bg-secondary text-foreground flex items-center gap-1">
                                        <Briefcase className="h-3 w-3" /> {selectedItem.modalidade_licitacao_nome}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[11px] uppercase border border-border bg-secondary text-foreground flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> {selectedItem.municipio_nome} - {selectedItem.uf}
                                    </span>
                                </div>
                            </DialogHeader>

                            <div className="p-6 space-y-8">
                                {/* Section 1: Órgão */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-1">
                                        <Building2 className="h-4 w-4" /> Info do Órgão
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-lg border border-border/50">
                                        <div>
                                            <span className="block text-xs text-muted-foreground mb-0.5">Instituição Licitante</span>
                                            <span className="text-sm font-semibold">{selectedItem.orgao_nome}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-muted-foreground mb-0.5">Unidade Compradora</span>
                                            <span className="text-sm">{selectedItem.unidade_nome || 'N/A'} {selectedItem.unidade_codigo ? `(${selectedItem.unidade_codigo})` : ''}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-muted-foreground mb-0.5">CNPJ</span>
                                            <span className="text-sm">{selectedItem.orgao_cnpj}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-muted-foreground mb-0.5">Poder Administrativo</span>
                                            <span className="text-sm">{selectedItem.esfera_nome} • {selectedItem.poder_nome}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-muted-foreground mb-0.5">Instrumento Convocatório</span>
                                            <span className="text-sm">{selectedItem.tipo_instrumento_convocacao_nome || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-muted-foreground mb-0.5">Amparo Legal / SRP</span>
                                            <span className="text-sm">{selectedItem.amparo_legal_nome?.slice(0, 30) || 'N/A'}{selectedItem.amparo_legal_nome?.length && selectedItem.amparo_legal_nome.length > 30 ? '...' : ''} • SRP: {selectedItem.srp ? 'Sim' : 'Não'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Objeto Detalhado */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-1">
                                        <FileText className="h-4 w-4" /> Objeto / Descrição
                                    </h3>
                                    <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
                                        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                            {selectedItem.description || "Descrição sumária não fornecida na ementa eletrônica."}
                                        </p>
                                    </div>
                                </div>

                                {/* Section 3: Prazos e Valores */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-1">
                                        <Calendar className="h-4 w-4" /> Valores & Cronograma
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-lg border border-border/50">
                                        <div>
                                            <span className="block text-[10px] text-muted-foreground uppercase mb-0.5 flex items-center"><DollarSign className="h-3 w-3 mr-0.5" /> Val. Estimado</span>
                                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedItem.valor_global)}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-muted-foreground uppercase mb-0.5">Publicação</span>
                                            <span className="text-sm">{formatDate(selectedItem.data_publicacao_pncp, true)}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-muted-foreground uppercase mb-0.5">Início Recepção</span>
                                            <span className="text-sm">{formatDate(selectedItem.data_inicio_vigencia, true)}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-muted-foreground uppercase mb-0.5">Fim Recepção</span>
                                            <span className="text-sm font-medium text-destructive">{formatDate(selectedItem.data_fim_vigencia, true)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 4: Arquivos Anexos */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-1">
                                        <FileText className="h-4 w-4" /> Arquivos Anexos
                                    </h3>
                                    <div className="bg-muted/10 border border-border rounded-lg overflow-hidden">
                                        {loadingFiles ? (
                                            <div className="p-6 flex items-center justify-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                            </div>
                                        ) : selectedItemFiles.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-muted-foreground">Nenhum arquivo listado na API do PNCP para este edital.</div>
                                        ) : (
                                            <ul className="divide-y divide-border">
                                                {selectedItemFiles.map((file, idx) => (
                                                    <li key={idx} className="p-3 hover:bg-muted/20 flex items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <input
                                                                type="checkbox"
                                                                title="Exportar para o Kunbun"
                                                                checked={selectedFilesToExport.some(f => f.url === file.url)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedFilesToExport(prev => [...prev, file]);
                                                                    else setSelectedFilesToExport(prev => prev.filter(f => f.url !== file.url));
                                                                }}
                                                                className="rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0 transition-all cursor-pointer"
                                                            />
                                                            <FileText className="h-5 w-5 text-primary shrink-0 opacity-80" />
                                                            <div className="truncate">
                                                                <span className="block text-sm font-semibold truncate" title={file.titulo}>{file.titulo}</span>
                                                                <span className="block text-[11px] text-muted-foreground uppercase">{file.tipoDocumentoNome}</span>
                                                            </div>
                                                        </div>
                                                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center justify-center h-8 w-8 rounded bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors outline-none focus:ring-2 focus:ring-primary" title="Download Arquivo Analítico">
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-3 sticky bottom-0 z-10 w-full overflow-hidden shrink-0 items-center">
                                <button
                                    onClick={() => setIsExportDialogOpen(true)}
                                    className="px-4 py-2 bg-foreground text-background text-sm font-bold rounded-md hover:bg-foreground/90 transition-all flex items-center justify-center gap-2 shadow-sm mr-auto"
                                >
                                    <KanbanSquare className="h-4 w-4" /> Exportar p/ Kunbun
                                </button>
                                <DialogClose asChild>
                                    <button className="px-4 py-2 border border-border bg-background hover:bg-muted text-foreground text-sm font-medium rounded-md transition-colors">
                                        Fechar Resumo
                                    </button>
                                </DialogClose>
                                <a
                                    href={getOfficialLink(selectedItem)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    Ir para o Edital Oficial <ExternalLink className="h-4 w-4" />
                                </a>
                            </div>

                            {/* Export to Kunbun Internal Dialog */}
                            <AnimatePresence>
                                {isExportDialogOpen && (
                                    <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                                        <DialogContent className="max-w-md bg-background border border-border rounded-xl shadow-2xl p-6 z-[110]">
                                            <DialogHeader className="mb-4">
                                                <DialogTitle className="flex items-center gap-2 text-lg">
                                                    <KanbanSquare className="h-5 w-5 text-primary" />
                                                    Exportar para o Kunbun (Kanban)
                                                </DialogTitle>
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    Escolha a pasta, o quadro e a coluna onde este edital deverá ser inserido como um novo Cartão de tarefa.
                                                </p>
                                            </DialogHeader>

                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold uppercase text-muted-foreground">1. Escolha a Pasta</label>
                                                    <select
                                                        value={exportFolderId}
                                                        onChange={(e) => {
                                                            setExportFolderId(e.target.value);
                                                            setExportBoardId('');
                                                            setExportListId('');
                                                        }}
                                                        className="w-full h-9 bg-muted border border-border rounded px-2 text-sm focus:ring-1 focus:ring-primary"
                                                    >
                                                        <option value="">Selecione uma pasta...</option>
                                                        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                    </select>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold uppercase text-muted-foreground">2. Escolha o Quadro (Board)</label>
                                                    <select
                                                        value={exportBoardId}
                                                        onChange={(e) => {
                                                            setExportBoardId(e.target.value);
                                                            setExportListId('');
                                                        }}
                                                        disabled={!exportFolderId}
                                                        className="w-full h-9 bg-muted border border-border rounded px-2 text-sm focus:ring-1 focus:ring-primary disabled:opacity-50"
                                                    >
                                                        <option value="">Selecione um quadro...</option>
                                                        {boards.filter(b => b.folderId === exportFolderId).map(b => (
                                                            <option key={b.id} value={b.id}>{b.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold uppercase text-muted-foreground">3. Escolha a Coluna Principal</label>
                                                    <select
                                                        value={exportListId}
                                                        onChange={(e) => setExportListId(e.target.value)}
                                                        disabled={!exportBoardId}
                                                        className="w-full h-9 bg-muted border border-border rounded px-2 text-sm focus:ring-1 focus:ring-primary disabled:opacity-50"
                                                    >
                                                        <option value="">Selecione a Lista de Destino...</option>
                                                        {lists.filter(l => l.boardId === exportBoardId).map(l => (
                                                            <option key={l.id} value={l.id}>{l.title}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="mt-8 flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => setIsExportDialogOpen(false)}
                                                    className="px-4 py-2 border border-border hover:bg-muted text-sm font-medium rounded-md transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={handleExportToKunbun}
                                                    disabled={!exportListId}
                                                    className="px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                                                >
                                                    Adicionar Cartão
                                                </button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </AnimatePresence>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>
        </div>
    );
}
