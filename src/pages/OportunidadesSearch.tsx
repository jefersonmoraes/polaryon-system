import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Search, Calendar, MapPin, Building2, ExternalLink, Filter, Loader2, AlertCircle, ChevronRight, FileText, X, DollarSign, Briefcase, KanbanSquare, Download, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogClose, DialogHeader } from '@/components/ui/dialog';
import { useLocation } from 'react-router-dom';
import api from '@/lib/api';
import { useKanbanStore } from '@/store/kanban-store';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Award, Info, Package, ShieldCheck, TrendingUp, Zap } from 'lucide-react';
import { socketService } from '@/lib/socket';

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

// --- Funções Auxiliares Globais ---
const formatDate = (dateString?: string, showTime = false) => {
    if (!dateString) return '-';
    try {
        const d = new Date(dateString);
        return showTime ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString('pt-BR');
    } catch {
        return dateString;
    }
};

const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'N/I';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

// Cache Global de Memória para detalhes do PNCP (evita requisições duplicadas entre componentes de data/valor)
const pncpDetailCache: Record<string, { data?: any; promise?: Promise<any> }> = {};

// Gerenciador de Fila para Requisições PNCP (Throttling) para evitar bloqueios por concorrência
const pncpRequestQueue: { cacheKey: string; item: PncpItem; resolve: (data: any) => void; reject: (err: any) => void }[] = [];
let activePncpRequests = 0;
const MAX_CONCURRENT_PNCP = 5;

async function processPncpQueue() {
    if (activePncpRequests >= MAX_CONCURRENT_PNCP || pncpRequestQueue.length === 0) return;

    activePncpRequests++;
    const { cacheKey, item, resolve, reject } = pncpRequestQueue.shift()!;

    try {
        const parts = item.numero_controle_pncp?.split('-');
        const orgaoCnpj = item.orgao_cnpj || parts?.[0];
        const ano = (item as any).ano_compra || (item as any).ano || parts?.[1];
        const seq = (item as any).numero_compra || (item as any).numero_sequencial || parts?.[2];

        if (!orgaoCnpj || !ano || !seq) {
            throw new Error("Missing keys for PNCP detail");
        }

        // USANDO PROXY DO BACKEND PARA EVITAR CORS E RATE LIMIT (REQUISITO PRODUÇÃO)
        const res = await api.get(`/transparency/pncp-detail/${orgaoCnpj}/${ano}/${seq}`);
        const detail = res.data;

        const result = {
            start: detail.dataRecebimentoProposta || detail.dataAberturaProposta || detail.dataHoraRegistroOcorrencia,
            end: detail.dataFimRecebimentoProposta || detail.dataEncerramentoProposta,
            valor: detail.valorTotalEstimado || detail.valor_global,
            raw: detail
        };
        
        if (pncpDetailCache[cacheKey]) pncpDetailCache[cacheKey].data = result;
        
        // DISPARA EVENTO GLOBAL PARA ATUALIZAR TODOS OS COMPONENTES QUE USAM ESTE CACHEKEY
        window.dispatchEvent(new CustomEvent('pncp-cache-updated', { detail: { cacheKey } }));
        
        resolve(result);
    } catch (e: any) {
        if (e.response?.status === 404) {
            resolve(null);
        } else {
            console.warn(`[PNCP Worker] Failed for ${cacheKey}:`, e.message);
            if (pncpDetailCache[cacheKey]) delete pncpDetailCache[cacheKey].promise;
            reject(e);
        }
    } finally {
        activePncpRequests--;
        setTimeout(processPncpQueue, 100);
    }
}

function queuePncpFetch(item: PncpItem): Promise<any> {
    const parts = item.numero_controle_pncp?.split('-');
    const orgaoCnpj = item.orgao_cnpj || parts?.[0];
    const ano = (item as any).ano_compra || (item as any).ano || parts?.[1];
    const seq = (item as any).numero_compra || (item as any).numero_sequencial || parts?.[2];
    const cacheKey = `${orgaoCnpj}-${ano}-${seq}`;

    if (pncpDetailCache[cacheKey]?.data) return Promise.resolve(pncpDetailCache[cacheKey].data);
    if (pncpDetailCache[cacheKey]?.promise) return pncpDetailCache[cacheKey].promise;

    const promise = new Promise((resolve, reject) => {
        pncpRequestQueue.push({ cacheKey, item, resolve, reject });
        processPncpQueue();
    });

    pncpDetailCache[cacheKey] = { promise };
    return promise;
}

const ProposalDates = memo(({ item }: { item: PncpItem }) => {
    const [dates, setDates] = useState<{ inicio?: string; fim?: string; loading: boolean }>({ loading: true });
    
    const parts = item.numero_controle_pncp?.split('-');
    const orgaoCnpj = item.orgao_cnpj || parts?.[0];
    const ano = (item as any).ano_compra || (item as any).ano || parts?.[1];
    const seq = (item as any).numero_compra || (item as any).numero_sequencial || parts?.[2];
    const cacheKey = `${orgaoCnpj}-${ano}-${seq}`;

    const updateFromCache = useCallback(() => {
        const cached = pncpDetailCache[cacheKey]?.data;
        if (cached) {
            setDates({
                inicio: cached.start,
                fim: cached.end,
                loading: false
            });
            return true;
        }
        return false;
    }, [cacheKey]);

    useEffect(() => {
        let isMounted = true;
        
        // Tenta pegar do cache primeiro
        if (updateFromCache()) return;

        setDates({ loading: true });
        queuePncpFetch(item).then((data) => {
            if (isMounted) {
                if (data) {
                    setDates({
                        inicio: data.start,
                        fim: data.end,
                        loading: false
                    });
                } else {
                    setDates({ loading: false });
                }
            }
        }).catch(() => {
            if (isMounted) setDates({ loading: false });
        });

        // Listener para atualizações de cache vindo de outros componentes (ex: modal)
        const handleUpdate = (e: any) => {
            if (e.detail?.cacheKey === cacheKey && isMounted) {
                updateFromCache();
            }
        };
        window.addEventListener('pncp-cache-updated', handleUpdate);

        return () => { 
            isMounted = false; 
            window.removeEventListener('pncp-cache-updated', handleUpdate);
        };
    }, [item.orgao_cnpj, item.numero_controle_pncp, cacheKey, updateFromCache]);

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

const PncpValue = memo(({ item, isMobile = false }: { item: PncpItem; isMobile?: boolean }) => {
    const [valor, setValor] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    const parts = item.numero_controle_pncp?.split('-');
    const orgaoCnpj = item.orgao_cnpj || parts?.[0];
    const ano = (item as any).ano_compra || (item as any).ano || parts?.[1];
    const seq = (item as any).numero_compra || (item as any).numero_sequencial || parts?.[2];
    const cacheKey = `${orgaoCnpj}-${ano}-${seq}`;

    const updateFromCache = useCallback(() => {
        const cached = pncpDetailCache[cacheKey]?.data;
        if (cached) {
            setValor(cached.valor);
            setLoading(false);
            return true;
        }
        return false;
    }, [cacheKey]);

    useEffect(() => {
        let isMounted = true;
        if (updateFromCache()) return;

        setLoading(true);
        queuePncpFetch(item).then((data) => {
            if (isMounted) {
                setValor(data?.valor || null);
                setLoading(false);
            }
        }).catch(() => {
            if (isMounted) setLoading(false);
        });

        const handleUpdate = (e: any) => {
            if (e.detail?.cacheKey === cacheKey && isMounted) {
                updateFromCache();
            }
        };
        window.addEventListener('pncp-cache-updated', handleUpdate);

        return () => { 
            isMounted = false; 
            window.removeEventListener('pncp-cache-updated', handleUpdate);
        };
    }, [item.orgao_cnpj, item.numero_controle_pncp, cacheKey, updateFromCache]);

    if (isMobile) {
        return (
            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shadow-sm ml-auto">
                <DollarSign className="h-2.5 w-2.5" />
                {loading ? <Loader2 className="h-2.5 w-2.5 animate-spin opacity-50" /> : formatCurrency(valor)}
            </div>
        );
    }

    return (
        <td className="px-4 py-3.5 align-top font-black text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto opacity-30" /> : formatCurrency(valor)}
        </td>
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
    const [valorMinFilter, setValorMinFilter] = useState('');
    const [valorMaxFilter, setValorMaxFilter] = useState('');

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
        setValorMinFilter('');
        setValorMaxFilter('');
        setPage(1);
    }, []);

    const [page, setPage] = useState(1);
    const [pageInput, setPageInput] = useState('1'); // Para digitação manual no Pagination footer
    const [results, setResults] = useState<PncpItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState('');
    const [totalResults, setTotalResults] = useState(0);

    const [selectedItem, setSelectedItem] = useState<PncpItem | null>(null);
    const [selectedItemFiles, setSelectedItemFiles] = useState<any[]>([]);
    const [selectedFilesToExport, setSelectedFilesToExport] = useState<any[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    
    // Novas Variáveis de Detalhamento
    const [fullItems, setFullItems] = useState<any[]>([]);
    const [loadingFullItems, setLoadingFullItems] = useState(false);
    const [cguDetails, setCguDetails] = useState<any>(null);
    const [loadingCgu, setLoadingCgu] = useState(false);
    
    // Novo Estado para Detalhamento Completo PNCP (para pegar Valores, etc)
    const [itemDetail, setItemDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    
    // Estados para o Preview de Empenho no Sistema
    const [previewEmpenhoUrl, setPreviewEmpenhoUrl] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const getOfficialLink = useCallback((item: PncpItem) => {
        if (!item?.item_url) return '#';
        if (item.item_url.startsWith('http')) return item.item_url;
        return `https://pncp.gov.br${item.item_url.replace('/compras/', '/app/editais/')}`;
    }, []);

    useEffect(() => {
        if (!selectedItem) {
            setSelectedItemFiles([]);
            setFullItems([]);
            setCguDetails(null);
            return;
        }

        const fetchDetails = async () => {
            const ano = (selectedItem as any).ano_compra || (selectedItem as any).ano;
            const seq = (selectedItem as any).numero_compra || (selectedItem as any).numero_sequencial;
            const cnpj = selectedItem.orgao_cnpj;

            if (!cnpj || !ano || !seq) return;

            // 0. Fetch Main Purchase Detail (V1) - Para pegar Valores Estimados que faltam na busca
            setLoadingDetail(true);
            try {
                const data = await queuePncpFetch(selectedItem);
                if (data?.raw) {
                    setItemDetail(data.raw);
                }
            } catch (e) {
                console.error("Failed to fetch purchase detail", e);
            } finally {
                setLoadingDetail(false);
            }

            // 1. Fetch Files (Original)
            setLoadingFiles(true);
            try {
                const res = await api.get(`/transparency/licitacoes/${cnpj}/${ano}/${seq}/arquivos`);
                setSelectedItemFiles(res.data || []);
                setSelectedFilesToExport(res.data || []);
            } catch (e) {
                console.error("Failed to fetch files", e);
            } finally {
                setLoadingFiles(false);
            }

            // 2. Fetch Full Items (New)
            setLoadingFullItems(true);
            try {
                const res = await api.get(`/transparency/licitacoes/${cnpj}/${ano}/${seq}/itens-completos`, {
                    params: { termo: keyword }
                });
                setFullItems(res.data || []);
            } catch (e) {
                console.error("Failed to fetch full items", e);
            } finally {
                setLoadingFullItems(false);
            }

            // 3. Fetch CGU Data (New)
            setLoadingCgu(true);
            try {
                const res = await api.get(`/transparency/licitacoes/${cnpj}/${ano}/${seq}/cgu`);
                setCguDetails(res.data || null);
            } catch (e) {
                console.error("Failed to fetch CGU data", e);
            } finally {
                setLoadingCgu(false);
            }
        };

        fetchDetails();
    }, [selectedItem]);

    // --- Kanban Export States ---
    const folders = useKanbanStore(state => state?.folders) || [];
    const boards = useKanbanStore(state => state?.boards) || [];
    const lists = useKanbanStore(state => state?.lists) || [];
    const allMembers = useKanbanStore(state => state?.members);
    const currentUser = (allMembers || [])[0] || null;
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [exportFolderId, setExportFolderId] = useState('');
    const [exportBoardId, setExportBoardId] = useState('');
    const [exportListId, setExportListId] = useState('');
    const [exportErrors, setExportErrors] = useState<Record<string, boolean>>({});

    // Persistence for Export to Kanban
    useEffect(() => {
        if (folders.length === 0) return;
        
        const lastFolder = localStorage.getItem('POLARYON_LAST_EXPORT_FOLDER');
        const lastBoard = localStorage.getItem('POLARYON_LAST_EXPORT_BOARD');
        const lastList = localStorage.getItem('POLARYON_LAST_EXPORT_LIST');

        if (lastFolder && folders.some(f => f.id === lastFolder)) {
            setExportFolderId(lastFolder);
            if (lastBoard && boards.some(b => b.id === lastBoard && b.folderId === lastFolder)) {
                setExportBoardId(lastBoard);
                if (lastList && lists.some(l => l.id === lastList && l.boardId === lastBoard)) {
                    setExportListId(lastList);
                }
            }
        }
    }, [folders.length, boards.length, lists.length]);

    const handleExportToKanban = () => {
        const newErrors: Record<string, boolean> = {};
        if (!exportFolderId) newErrors.folder = true;
        if (!exportBoardId) newErrors.board = true;
        if (!exportListId) newErrors.list = true;

        if (Object.keys(newErrors).length > 0) {
            setExportErrors(newErrors);
            toast.error("Por favor, selecione o destino completo para exportação.");
            return;
        }

        if (!selectedItem) return;

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

        // Robustly extract estimated value - PRIORITIZE itemDetail if available
        const itemAny = selectedItem as any;
        const detailAny = itemDetail as any;
        
        const estimatedValue = 
            detailAny?.valorTotalEstimado || 
            itemAny.valorTotalEstimado || 
            itemAny.valor_global || 
            itemAny.valor ||
            itemAny.valor_total_estimado || 
            detailAny?.valor ||
            0;

        const formattedValue = estimatedValue > 0 
            ? `  ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estimatedValue)}` 
            : '';

        const cardParams = {
            title: `${selectedItem.title}${formattedValue}`,
            summary: selectedItem.description || selectedItem.title || "Oportunidade importada do GovBr",
            description: descriptionMD,
            listId: exportListId,
            position: 0,
            labels: [],
            assignee: null,
            completed: false,
            archived: false,
            trashed: false,
        };

        // Inject Attachments (Selected Files only)
        const cardAttachments: any[] = [];

        for (const file of selectedFilesToExport) {
            cardAttachments.push({
                id: crypto.randomUUID(),
                name: file.titulo || file.tipoDocumentoNome,
                url: file.url,
                type: "pdf", // Fallback type
                addedAt: new Date().toISOString()
            });
        }

        // Inject Items from fullItems
        const cardItems: any[] = [];
        if (fullItems && fullItems.length > 0) {
            fullItems.forEach((item: any) => {
                cardItems.push({
                    id: crypto.randomUUID(),
                    name: item.descricao || "Item sem descrição",
                    unitValue: item.valorUnitarioEstimado || 0,
                    quantity: item.quantidade || 1
                });
            });
        }

        // Create Full Card Object
        const newCardData = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            comments: [],
            attachments: cardAttachments,
            items: cardItems,
            checklist: [],
            timeEntries: [],
            milestones: [],
            pncpId: selectedItem.numero_controle_pncp || selectedItem.orgao_cnpj,
            ...cardParams
        };

        // 1. Update LOCAL store instantly (Optimistic)
        useKanbanStore.setState(state => ({
            cards: [newCardData, ...state.cards] 
        }));

        // 2. Notify other clients via Socket instantly
        try {
            if (socketService) {
                // Emit system_action to make others sync or add
                socketService.emit('system_action', { 
                    store: 'KANBAN', 
                    type: 'ADD_CARD', 
                    payload: newCardData 
                });
            }
        } catch (e) {
            console.error("Socket emit failed:", e);
        }

        // 3. Persist to DB
        api.post('/kanban/cards', newCardData).catch(e => console.error("Export Kanban Sync failed", e));

        // 4. Save persistence preferences
        localStorage.setItem('POLARYON_LAST_EXPORT_FOLDER', exportFolderId);
        localStorage.setItem('POLARYON_LAST_EXPORT_BOARD', exportBoardId);
        localStorage.setItem('POLARYON_LAST_EXPORT_LIST', exportListId);

        toast.success("Oportunidade exportada! Cartão criado no Kanban.");
        setIsExportDialogOpen(false);
    };

    const fetchOportunidades = useCallback(async (currentPage = 1) => {
        setLoading(true);
        setError('');
        setLoadingMessage('');
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

            // GREEDY FETCH: Se houver filtros de valor, precisamos buscar os detalhes ANTES de filtrar,
            // pois a API de pesquisa do PNCP não retorna o valor estimado.
            const hasValueFilter = (valorMinFilter && !isNaN(parseFloat(valorMinFilter))) || 
                                   (valorMaxFilter && !isNaN(parseFloat(valorMaxFilter)));
            
            if (hasValueFilter && items.length > 0) {
                setLoadingMessage("Aplicando filtros de valor (consultando detalhes oficiais)...");
                const detailedItems = await Promise.all(items.map(async (item) => {
                    try {
                        const detail = await queuePncpFetch(item);
                        return { ...item, valorTotalEstimado: detail?.valor || 0, valor_global: detail?.valor || 0 };
                    } catch (e) {
                        return item;
                    }
                }));
                items = detailedItems;
            }

            // --- Client-Side "Mega Filters" Fallback ---
            if (ufFilter) items = items.filter((i: PncpItem) => i?.uf === ufFilter);
            if (esferaFilter) items = items.filter((i: any) => i?.esfera_id === esferaFilter);
            if (orgaoFilter) items = items.filter((i: PncpItem) => (i?.orgao_nome?.toLowerCase() || '').includes(orgaoFilter.toLowerCase()) || (i?.orgao_cnpj || '').includes(orgaoFilter));
            if (modalidadeFilter) items = items.filter((i: PncpItem) => (i?.modalidade_licitacao_nome?.toLowerCase() || '').includes(modalidadeFilter.toLowerCase()));
            if (municipioFilter) items = items.filter((i: PncpItem) => (i?.municipio_nome?.toLowerCase() || '').includes(municipioFilter.toLowerCase()));
            if (poderFilter) items = items.filter((i: any) => (i?.poder_nome?.toLowerCase() || '') === poderFilter.toLowerCase());

            if (unidadeFilter) items = items.filter((i: any) => (i?.unidade_nome?.toLowerCase() || '').includes(unidadeFilter.toLowerCase()) || (i?.unidade_codigo || '').includes(unidadeFilter));
            if (fonteOrcamentoFilter) items = items.filter((i: any) => (i?.fonte_orcamentaria?.toLowerCase() || '').includes(fonteOrcamentoFilter.toLowerCase()));
            if (conteudoNacionalFilter) items = items.filter((i: any) => {
                if (conteudoNacionalFilter === 'Sim') return i?.exigencia_conteudo_nacional === true;
                if (conteudoNacionalFilter === 'Não') return i?.exigencia_conteudo_nacional === false;
                return true;
            });
            if (margemPreferenciaFilter) items = items.filter((i: any) => (i?.tipo_margem_preferencia_nome?.toLowerCase() || '').includes(margemPreferenciaFilter.toLowerCase()));

            // Valor Min/Max Filter - AGORA FUNCIONA POIS TEMOS OS DADOS DO DETALHAMENTO
            if (valorMinFilter) {
                const min = parseFloat(valorMinFilter.replace(/[^\d.]/g, ''));
                if (!isNaN(min)) {
                    items = items.filter((i: any) => (i.valorTotalEstimado || i.valor_global || 0) >= min);
                }
            }
            if (valorMaxFilter) {
                const max = parseFloat(valorMaxFilter.replace(/[^\d.]/g, ''));
                if (!isNaN(max)) {
                    items = items.filter((i: any) => (i.valorTotalEstimado || i.valor_global || 0) <= max);
                }
            }

            // Client-Side Ordering
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
            setLoadingMessage('');
        }
    }, [
        keyword, ufFilter, modalidadeFilter, statusFilter, instrumentoFilter,
        esferaFilter, dataInicialFilter, dataFinalFilter, ordenacaoFilter,
        orgaoFilter, municipioFilter, poderFilter, unidadeFilter,
        fonteOrcamentoFilter, conteudoNacionalFilter, margemPreferenciaFilter,
        valorMinFilter, valorMaxFilter
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

    const getStatusStyle = useCallback((situacao: string) => {
        const lower = situacao.toLowerCase();
        if (lower.includes('divulgada')) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        if (lower.includes('suspensa')) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
        if (lower.includes('encerrada') || lower.includes('revogada')) return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
        return 'bg-secondary text-foreground border-border';
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
                        <div className="flex flex-col lg:flex-row gap-2">
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
                            <div className="flex flex-wrap md:flex-nowrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                    className={`flex-1 md:flex-none h-10 px-4 text-sm font-medium rounded-md border transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap ${isAdvancedOpen ? 'bg-secondary text-secondary-foreground border-border' : 'bg-background hover:bg-secondary border-border'}`}
                                >
                                    <Filter className="h-4 w-4" />
                                    <span className="hidden sm:inline">Filtros Avançados</span>
                                    <span className="sm:hidden">Filtros</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                    className="flex-1 md:flex-none h-10 px-4 text-sm font-medium rounded-md border border-border bg-background hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                                    title="Restaurar filtro padrão de lote inicial"
                                >
                                    <X className="h-4 w-4" />
                                    <span className="hidden sm:inline">Limpar Filtros</span>
                                    <span className="sm:hidden">Limpar</span>
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full md:w-auto h-10 px-6 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    Pesquisar
                                </button>
                            </div>
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
                                        <option value="1">Divulgada (Recente)</option>
                                        <option value="2">Em Andamento (Licitação)</option>
                                        <option value="3">Concluída (Ranking Disponível)</option>
                                        <option value="4">Suspensa</option>
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
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><DollarSign className="h-2.5 w-2.5" /> Valor Mínimo (R$)</label>
                                    <input 
                                        type="number" 
                                        placeholder="Ex: 5000" 
                                        value={valorMinFilter} 
                                        onChange={(e) => setValorMinFilter(e.target.value)} 
                                        className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><DollarSign className="h-2.5 w-2.5" /> Valor Máximo (R$)</label>
                                    <input 
                                        type="number" 
                                        placeholder="Ex: 100000" 
                                        value={valorMaxFilter} 
                                        onChange={(e) => setValorMaxFilter(e.target.value)} 
                                        className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" 
                                    />
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

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto bg-muted/20 relative">
                {loading && (results.length === 0 || loadingMessage) ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-20">
                        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                        <p className="text-sm font-medium text-muted-foreground animate-pulse text-center max-w-xs">
                            {loadingMessage || "Consultando Diário Oficial / PNCP..."}
                        </p>
                    </div>
                ) : results.length === 0 ? (
                    <div className="max-w-md mx-auto mt-20 p-8 text-center bg-background rounded-xl border border-border shadow-sm">
                        <Filter className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <h3 className="text-base font-semibold mb-1">Nenhuma Licitação Encontrada</h3>
                        <p className="text-sm text-muted-foreground">O filtro selecionado não retornou resultados no lote atual. Tente remover filtros ou usar sinônimos.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block w-full min-w-[900px]">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-muted text-muted-foreground sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 font-medium w-32">Status</th>
                                        <th className="px-4 py-3 font-medium w-40">Publicação</th>
                                        <th className="px-4 py-3 font-medium w-32">Início Recepção</th>
                                        <th className="px-4 py-3 font-medium w-32">Fim Recepção</th>
                                        <th className="px-4 py-3 font-medium w-32 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5">Valor Est.</th>
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
                                            <PncpValue item={item} />
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

                        {/* Mobile Card View */}
                        <div className="md:hidden p-4 space-y-4">
                            {results.map((item, index) => (
                                <div
                                    key={item.id || index}
                                    onClick={() => setSelectedItem(item)}
                                    className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3 active:scale-[0.98] transition-all"
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold border ${getStatusStyle(item.situacao_nome)}`}>
                                            {item.situacao_nome}
                                        </span>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold bg-muted px-2 py-0.5 rounded">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(item.data_publicacao_pncp)}
                                        </div>
                                        <PncpValue item={item} isMobile />
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-xs font-bold uppercase text-foreground leading-tight line-clamp-2">
                                            {item.orgao_nome}
                                        </h3>
                                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                            {item.description || item.title}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                                        <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-[10px] font-bold uppercase">
                                            {item.modalidade_licitacao_nome}
                                        </span>
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded border border-primary/10">
                                            <MapPin className="h-3 w-3" />
                                            {item.uf || '-'}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                                        <div className="flex gap-3">
                                            <div className="flex flex-col">
                                                <span className="uppercase text-[8px] font-black opacity-50">Encerramento</span>
                                                <span className="font-bold text-rose-500/80">
                                                    {item.data_fim_vigencia ? new Date(item.data_fim_vigencia).toLocaleDateString('pt-BR') : '-'}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-primary" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
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

                            <div className="flex-1 overflow-hidden">
                                <Tabs defaultValue="overview" className="h-full flex flex-col">
                                    <div className="px-6 border-b border-border bg-card/50 sticky top-0 z-20 overflow-x-auto">
                                        <TabsList className="bg-transparent h-12 gap-6 p-0 flex-nowrap min-w-max">
                                            <TabsTrigger value="overview" className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-xs font-bold uppercase tracking-wider">
                                                <Info className="h-3.5 w-3.5 mr-2" /> Visão Geral
                                            </TabsTrigger>
                                            <TabsTrigger value="items" className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-xs font-bold uppercase tracking-wider">
                                                <Package className="h-3.5 w-3.5 mr-2" /> Itens e Vencedores
                                            </TabsTrigger>
                                            <TabsTrigger value="transparency" className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-xs font-bold uppercase tracking-wider">
                                                <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Portal da Transparência
                                            </TabsTrigger>
                                            <TabsTrigger value="files" className="h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 text-xs font-bold uppercase tracking-wider">
                                                <FileText className="h-3.5 w-3.5 mr-2" /> Arquivos PNCP
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <div className="flex-1 overflow-y-auto">
                                        <TabsContent value="overview" className="p-6 space-y-8 m-0 focus-visible:outline-none">
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
                                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                            {loadingDetail ? (
                                                                <Loader2 className="h-3 w-3 animate-spin inline-block" />
                                                            ) : (
                                                                formatCurrency(itemDetail?.valorTotalEstimado || selectedItem.valorTotalEstimado || selectedItem.valor_global)
                                                            )}
                                                        </span>
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
                                        </TabsContent>

                                        <TabsContent value="items" className="p-6 m-0 focus-visible:outline-none">
                                            {loadingFullItems ? (
                                                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                                                    <p className="text-sm font-medium text-muted-foreground">Extraindo itens e cruzando resultados...</p>
                                                </div>
                                            ) : fullItems.length === 0 ? (
                                                <div className="text-center py-20 opacity-50 space-y-4">
                                                    <Package className="h-16 w-16 mx-auto text-muted-foreground/30" />
                                                    <p className="text-sm font-medium uppercase tracking-widest">Nenhum item granulado disponível para este edital.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-4">
                                                    {fullItems.map((item, idx) => (
                                                        <div key={idx} className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-all group overflow-hidden relative">
                                                            <div className="flex flex-col lg:flex-row gap-6">
                                                                <div className="flex-1 space-y-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-sm">ITEM {item.numero}</span>
                                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.situacao}</span>
                                                                    </div>
                                                                    <h4 className="font-bold text-sm leading-snug text-foreground uppercase tracking-tight line-clamp-2" title={item.descricao}>
                                                                        {item.descricao}
                                                                    </h4>
                                                                    
                                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                                                                        <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
                                                                            <span className="block text-[9px] font-black text-muted-foreground uppercase tracking-tighter">Quantidade</span>
                                                                            <span className="text-xs font-bold">{item.quantidade} <span className="text-[10px] font-normal opacity-60 lowercase">{item.unidadeMedida}</span></span>
                                                                        </div>
                                                                        <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
                                                                            <span className="block text-[9px] font-black text-muted-foreground uppercase tracking-tighter">Valor Unit. Est.</span>
                                                                            <span className="text-xs font-bold text-primary">{formatCurrency(item.valorUnitarioEstimado)}</span>
                                                                        </div>
                                                                        <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
                                                                            <span className="block text-[9px] font-black text-muted-foreground uppercase tracking-tighter">Valor Total Est.</span>
                                                                            <span className="text-xs font-bold">{formatCurrency(item.valorTotalEstimado)}</span>
                                                                        </div>
                                                                        <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
                                                                            <span className="block text-[9px] font-black text-muted-foreground uppercase tracking-tighter">Marca PNCP</span>
                                                                            <span className="text-xs font-bold truncate block">{item.marca || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {item.vencedor && (
                                                                    <div className="lg:w-80 shrink-0 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                                                                        <div className="absolute top-0 right-0 p-2 opacity-10">
                                                                            <Award className="h-12 w-12 text-emerald-500" />
                                                                        </div>
                                                                        <div className="space-y-3 relative z-10">
                                                                            <div className="flex items-center gap-2">
                                                                                <Award className="h-4 w-4 text-emerald-500" />
                                                                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Empresa Vencedora</span>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-black text-foreground line-clamp-2 leading-none">{item.vencedor.nome}</p>
                                                                                <p className="text-[10px] font-bold text-muted-foreground mt-1">CNPJ: {item.vencedor.cnpj}</p>
                                                                            </div>
                                                                            
                                                                            <div className="bg-background/80 backdrop-blur-sm rounded-lg p-2 border border-emerald-500/20">
                                                                               <div className="flex justify-between items-center mb-1">
                                                                                    <span className="text-[9px] font-black text-muted-foreground uppercase">Marca Ofertada</span>
                                                                                    <Zap className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                                                                               </div>
                                                                               <p className="text-xs font-black text-emerald-600 truncate">{item.vencedor.marcaFornecedor || item.marca || 'N/I'}</p>
                                                                            </div>

                                                                            {item.vencedor.empenhoUrl && (
                                                                                <button 
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setPreviewEmpenhoUrl(item.vencedor.empenhoUrl);
                                                                                        setIsPreviewOpen(true);
                                                                                    }}
                                                                                    className="mt-2 flex items-center justify-center gap-2 w-full py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                                                                >
                                                                                    <FileText className="h-3 w-3" />
                                                                                    VER NOTA DE EMPENHO
                                                                                    <ExternalLink className="h-2.5 w-2.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        <div className="mt-4 pt-3 border-t border-emerald-500/10 flex items-center justify-between">
                                                                            <span className="text-[10px] font-black text-muted-foreground uppercase">Valor Homologado</span>
                                                                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(item.vencedor.valor)}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="transparency" className="p-6 m-0 focus-visible:outline-none">
                                            {loadingCgu ? (
                                                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                                                    <p className="text-sm font-medium text-muted-foreground">Cruzando dados com o Portal da Transparência...</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
                                                        <div className="p-4 bg-primary text-primary-foreground rounded-2xl shadow-xl shadow-primary/20 shrink-0">
                                                            <ShieldCheck className="h-10 w-10" />
                                                        </div>
                                                        <div className="flex-1 text-center md:text-left">
                                                            <h3 className="text-lg font-black tracking-tight uppercase">Inteligência de Transparência</h3>
                                                            <p className="text-xs text-muted-foreground font-medium leading-relaxed max-w-2xl">
                                                                Integramos seu token oficial da CGU para rastrear o histórico financeiro e conformidade deste órgão. 
                                                                Abaixo, dados diretos extraídos do **Portal da Transparência**.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {!cguDetails?.cguData ? (
                                                        <div className="bg-muted/10 border-2 border-dashed border-border rounded-2xl p-12 text-center space-y-4">
                                                            <TrendingUp className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                                                            <div className="space-y-2">
                                                                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Licitação em Fase de Registro</h4>
                                                                <p className="text-xs text-muted-foreground max-w-md mx-auto italic">
                                                                    O Portal da Transparência (CGU) demora cerca de 15-30 dias para indexar novos editais após a abertura no PNCP. 
                                                                    Acompanhe aqui o fluxo de empenho e pagamentos assim que homologado.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            {/* Resumo da Licitação na CGU */}
                                                            <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
                                                                <h4 className="text-xs font-black uppercase text-primary tracking-widest border-b border-border pb-2 flex items-center gap-2">
                                                                    <BarChart3 className="h-4 w-4" /> Registro CGU: {cguDetails.cguData.numeroLicitacao}
                                                                </h4>
                                                                <div className="space-y-3">
                                                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                                                        <span className="text-xs font-bold text-muted-foreground">Valor Total Licitado (CGU)</span>
                                                                        <span className="text-sm font-black text-foreground">{formatCurrency(cguDetails.cguData.valorLicitacao)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                                                        <span className="text-xs font-bold text-muted-foreground">Data Resultado</span>
                                                                        <span className="text-sm font-bold">{cguDetails.cguData.dataResultado || '-'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                                                        <span className="text-xs font-bold text-muted-foreground">Situação no Portal</span>
                                                                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-sm text-[10px] font-black uppercase">{cguDetails.cguData.situacao}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center items-center text-center space-y-4">
                                                                <Zap className="h-12 w-12 text-amber-500 animate-pulse" />
                                                                <div>
                                                                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Insights de Mercado</h4>
                                                                    <p className="text-sm font-bold mt-1">Este órgão já transacionou {cguDetails.allResults?.length || 0} licitações similares recentemente.</p>
                                                                    <p className="text-[10px] text-muted-foreground mt-2 uppercase font-black">Fonte: api.portaldatransparencia.gov.br</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="files" className="p-6 m-0 focus-visible:outline-none">
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-1">
                                                    <FileText className="h-4 w-4" /> Repositório de Documentos
                                                </h3>
                                                <div className="bg-muted/10 border border-border rounded-2xl overflow-hidden">
                                                    {loadingFiles ? (
                                                        <div className="p-12 flex items-center justify-center">
                                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                        </div>
                                                    ) : selectedItemFiles.length === 0 ? (
                                                        <div className="p-12 text-center text-sm text-muted-foreground italic">Nenhum arquivo listado na API do PNCP para este edital.</div>
                                                    ) : (
                                                        <ul className="divide-y divide-border">
                                                            {selectedItemFiles.map((file, idx) => (
                                                                <li key={idx} className="p-4 hover:bg-muted/30 flex items-center justify-between gap-4 transition-colors">
                                                                    <div className="flex items-center gap-4 overflow-hidden">
                                                                        <input
                                                                            type="checkbox"
                                                                            title="Exportar para o Kanban"
                                                                            checked={selectedFilesToExport.some(f => f.url === file.url)}
                                                                            onChange={(e) => {
                                                                                if (e.target.checked) setSelectedFilesToExport(prev => [...prev, file]);
                                                                                else setSelectedFilesToExport(prev => prev.filter(f => f.url !== file.url));
                                                                            }}
                                                                            className="rounded border-border text-primary focus:ring-primary h-5 w-5 shrink-0 transition-all cursor-pointer"
                                                                        />
                                                                        <div className="p-2 bg-primary/5 rounded-lg text-primary">
                                                                            <FileText className="h-5 w-5 opacity-80" />
                                                                        </div>
                                                                        <div className="truncate">
                                                                            <span className="block text-sm font-bold truncate uppercase tracking-tight" title={file.titulo}>{file.titulo || file.nome}</span>
                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                <span className="text-[9px] font-black text-muted-foreground uppercase">{file.tipoDocumentoNome || 'Documento Geral'}</span>
                                                                                {file.isWinnerDoc && <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-sm uppercase flex items-center items-center gap-1"><Award className="h-2 w-2" /> Vencedor</span>}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-primary-foreground hover:scale-110 active:scale-95 transition-all shadow-md shadow-primary/20" title="Download Arquivo PNCP">
                                                                        <Download className="h-4.5 w-4.5" />
                                                                    </a>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </div>

                            <div className="p-4 border-t border-border bg-muted/50 flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0 z-10 w-full overflow-hidden shrink-0 items-stretch sm:items-center">
                                <button
                                    onClick={() => setIsExportDialogOpen(true)}
                                    className="px-4 py-2 bg-foreground text-background text-sm font-bold rounded-md hover:bg-foreground/90 transition-all flex items-center justify-center gap-2 shadow-sm order-2 sm:order-none sm:mr-auto"
                                >
                                    <KanbanSquare className="h-4 w-4" /> Exportar p/ Kanban
                                </button>
                                <DialogClose asChild>
                                    <button className="px-4 py-2 border border-border bg-background hover:bg-muted text-foreground text-sm font-medium rounded-md transition-colors order-3 sm:order-none">
                                        Fechar
                                    </button>
                                </DialogClose>
                                <a
                                    href={getOfficialLink(selectedItem)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm order-1 sm:order-none"
                                >
                                    Abrir Edital Oficial <ExternalLink className="h-4 w-4" />
                                </a>
                            </div>

                            {/* Export to Kanban Internal Dialog */}
                            <AnimatePresence>
                                {isExportDialogOpen && (
                                    <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                                        <DialogContent className="max-w-md bg-background border border-border rounded-xl shadow-2xl p-6 z-[110]">
                                            <DialogHeader className="mb-4">
                                                <DialogTitle className="flex items-center gap-2 text-lg">
                                                    <KanbanSquare className="h-5 w-5 text-primary" />
                                                    Exportar para o Kanban
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
                                                            setExportErrors(prev => ({ ...prev, folder: false }));
                                                        }}
                                                        className={`w-full h-9 bg-muted border rounded px-2 text-sm focus:ring-1 focus:ring-primary transition-all ${exportErrors.folder ? 'border-destructive ring-1 ring-destructive animate-shake' : 'border-border'}`}
                                                    >
                                                        <option value="">Selecione uma pasta...</option>
                                                        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                    </select>
                                                    {exportErrors.folder && <p className="text-[10px] text-destructive font-bold uppercase mt-0.5 animate-in fade-in slide-in-from-top-1">Seleção obrigatória</p>}
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold uppercase text-muted-foreground">2. Escolha o Quadro (Board)</label>
                                                    <select
                                                        value={exportBoardId}
                                                        onChange={(e) => {
                                                            setExportBoardId(e.target.value);
                                                            setExportListId('');
                                                            setExportErrors(prev => ({ ...prev, board: false }));
                                                        }}
                                                        disabled={!exportFolderId}
                                                        className={`w-full h-9 bg-muted border rounded px-2 text-sm focus:ring-1 focus:ring-primary transition-all disabled:opacity-50 ${exportErrors.board ? 'border-destructive ring-1 ring-destructive animate-shake' : 'border-border'}`}
                                                    >
                                                        <option value="">Selecione um quadro...</option>
                                                        {boards.filter(b => b.folderId === exportFolderId).map(b => (
                                                            <option key={b.id} value={b.id}>{b.name}</option>
                                                        ))}
                                                    </select>
                                                    {exportErrors.board && <p className="text-[10px] text-destructive font-bold uppercase mt-0.5 animate-in fade-in slide-in-from-top-1">Seleção obrigatória</p>}
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold uppercase text-muted-foreground">3. Escolha a Coluna Principal</label>
                                                    <select
                                                        value={exportListId}
                                                        onChange={(e) => {
                                                            setExportListId(e.target.value);
                                                            setExportErrors(prev => ({ ...prev, list: false }));
                                                        }}
                                                        disabled={!exportBoardId}
                                                        className={`w-full h-9 bg-muted border rounded px-2 text-sm focus:ring-1 focus:ring-primary transition-all disabled:opacity-50 ${exportErrors.list ? 'border-destructive ring-1 ring-destructive animate-shake' : 'border-border'}`}
                                                    >
                                                        <option value="">Selecione a Lista de Destino...</option>
                                                        {lists.filter(l => l.boardId === exportBoardId).map(l => (
                                                            <option key={l.id} value={l.id}>{l.title}</option>
                                                        ))}
                                                    </select>
                                                    {exportErrors.list && <p className="text-[10px] text-destructive font-bold uppercase mt-0.5 animate-in fade-in slide-in-from-top-1">Seleção obrigatória</p>}
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
                                                    onClick={handleExportToKanban}
                                                    disabled={loadingFullItems}
                                                    className="px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {loadingFullItems ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Carregando Itens...
                                                        </>
                                                    ) : (
                                                        'Adicionar Cartão'
                                                    )}
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

            {/* Modal de Preview da Nota de Empenho (Dentro do Sistema) */}
            <AnimatePresence>
                {isPreviewOpen && previewEmpenhoUrl && (
                    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 border-border bg-background shadow-2xl z-[150] flex flex-col sm:rounded-xl overflow-hidden">
                            <DialogHeader className="p-4 border-b border-border bg-emerald-600 text-white flex-row items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-md font-bold text-white uppercase tracking-tight">
                                            Nota de Empenho Oficial
                                        </DialogTitle>
                                        <p className="text-[10px] opacity-80 font-medium">Extraído do Portal da Transparência (CGU)</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                     <a 
                                        href={previewEmpenhoUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="h-8 px-3 bg-white/10 hover:bg-white/20 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors border border-white/20"
                                     >
                                        <ExternalLink className="h-3.5 w-3.5" /> Abrir no Portal
                                     </a>
                                     <button 
                                        onClick={() => setIsPreviewOpen(false)}
                                        className="h-8 w-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                                     >
                                        <X className="h-4 w-4" />
                                     </button>
                                </div>
                            </DialogHeader>
                            
                            <div className="flex-1 bg-white relative">
                                <iframe 
                                    src={previewEmpenhoUrl} 
                                    className="w-full h-full border-none"
                                    title="Nota de Empenho"
                                />
                                {/* Overlay de carregamento caso necessário */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                                    <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>
        </div>
    );
}
