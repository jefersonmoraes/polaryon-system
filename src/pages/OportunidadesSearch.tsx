import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Search, Calendar, MapPin, Building2, ExternalLink, Filter, Loader2, AlertCircle, ChevronRight, FileText, X, DollarSign, Briefcase, KanbanSquare, Download, Clock, CheckSquare, LogIn } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogClose, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { useLocation } from 'react-router-dom';
import api from '@/lib/api';
import { useKanbanStore } from '@/store/kanban-store';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Award, Info, Package, ShieldCheck, TrendingUp, Zap, Paperclip } from 'lucide-react';
import { socketService } from '@/lib/socket';
import { FilePreviewModal } from '@/components/ui/FilePreviewModal';
import { getSafeProxyUrl, normalizeFileUrl, cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

// --- Captcha Manager for PNCP Portal Endpoint ---
let hcaptchaWidgetId: number | null = null;
let hcaptchaResolve: ((token: string) => void) | null = null;

const getCaptchaToken = async (): Promise<string> => {
    const config = await axios.get('https://pncp.gov.br/api/pncp/v1/captcha/configuracao', {
        headers: { 'Accept': 'application/json' }
    });
    const { hcaptchaSiteKey, hcaptchaHabilitado } = config.data;

    if (!hcaptchaHabilitado || !hcaptchaSiteKey) {
        throw new Error('hCaptcha not available');
    }

    if (typeof (window as any).hcaptcha === 'undefined') {
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://js.hcaptcha.com/1/api.js?render=explicit&hl=pt`;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load hCaptcha'));
            document.head.appendChild(script);
        });
        // Aguarda hCaptcha se inicializar
        await new Promise(r => setTimeout(r, 1000));
    }

    const container = document.createElement('div');
    container.id = 'pncp-hcaptcha-container-' + Date.now();
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('hCaptcha timeout'));
        }, 30000);

        const cleanup = () => {
            clearTimeout(timeout);
            try { document.body.removeChild(container); } catch {}
        };

        try {
            const widgetId = (window as any).hcaptcha.render(container.id, {
                sitekey: hcaptchaSiteKey,
                size: 'invisible',
                callback: (token: string) => {
                    cleanup();
                    resolve(token);
                },
                'expired-callback': () => {
                    cleanup();
                    reject(new Error('hCaptcha expired'));
                },
                'error-callback': () => {
                    cleanup();
                    reject(new Error('hCaptcha error'));
                }
            });
            (window as any).hcaptcha.execute(widgetId);
        } catch (e: any) {
            cleanup();
            reject(e);
        }
    });
};

const fetchPncpPortalDirect = async (cnpj: string, ano: string, sequencial: string) => {
    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const token = await getCaptchaToken();
            const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/portal?captcha=${encodeURIComponent(token)}`;
            const res = await axios.get(url, {
                headers: { 'Accept': 'application/json' },
                timeout: 15000
            });
            return {
                dataEncerramentoProposta: res.data.dataEncerramentoProposta,
                dataAberturaProposta: res.data.dataAberturaProposta,
                linkSistemaOrigem: res.data.linkSistemaOrigem,
                valorTotalEstimado: res.data.valorTotalEstimado,
                valorTotalHomologado: res.data.valorTotalHomologado,
                situacaoCompraNome: res.data.situacaoCompraNome,
                usuarioNome: res.data.usuarioNome
            };
        } catch (e: any) {
            lastError = e;
            if (e.response?.status === 422) continue; // captcha invalido, tenta outro
            if (e.response?.status === 429) { await new Promise(r => setTimeout(r, 2000)); continue; }
            throw e;
        }
    }
    throw lastError || new Error('Failed to fetch portal data');
};

// Global handler to suppress unhandled promise rejections from PNCP API calls
if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
        const msg = (event.reason?.message || event.reason || '').toString().toLowerCase();
        // Ignora erros conhecidos de CORS/Timeout das APIs gov
        if (msg.includes('network error') || msg.includes('cors') || msg.includes('timeout') || msg.includes('404') || msg.includes('econn') || msg.includes('quotaexceeded')) {
            event.preventDefault();
        }
    });
}

// --- Direct Government APIs Fetch Engine for Desktop Terminal (v3.8.60) ---
// Bypasses the backend proxy to prevent F5 BIG-IP WAF block of the VPS IP
const serializePncpParams = (params: any) => {
    const parts: string[] = [];
    Object.entries(params).forEach(([key, val]) => {
        if (val === undefined || val === null || val === '') return;
        const cleanKey = key.replace(/\[\d*\]$/, '');
        if (Array.isArray(val)) {
            parts.push(`${encodeURIComponent(cleanKey)}=${val.join('|')}`);
        } else {
            if (typeof val === 'string' && val.includes('|')) {
                parts.push(`${encodeURIComponent(cleanKey)}=${val}`);
            } else {
                parts.push(`${encodeURIComponent(cleanKey)}=${encodeURIComponent(String(val))}`);
            }
        }
    });
    return parts.join('&');
};

const extractBrandLocal = (text: string): string => {
    if (!text) return 'N/A';
    const upperText = text.toUpperCase();
    const commonBrands = [
        'INTEL', 'AMD', 'DELL', 'HP', 'LENOVO', 'ASUS', 'ACER', 'APPLE', 'SAMSUNG', 'LG',
        'SONY', 'PANASONIC', 'PHILIPS', 'TOSHIBA', 'XIAOMI', 'HUAWEI', 'CISCO', 'MICROSOFT',
        'ORACLE', 'SAP', 'IBM', 'EPSON', 'CANON', 'XEROX', 'BROTHER', 'LOGITECH', 'CORSAIR',
        'RAZER', 'KINGSTON', 'SANDISK', 'SEAGATE', 'WESTERN DIGITAL', 'NVIDIA', 'INTELBRAS',
        'MULTILASER', 'POSITIVO', 'MANDAL', 'WEG', 'SIEMENS', 'ABB', 'SCHNEIDER', 'LEGRAND',
        'TRAMONTINA', 'PIAL', 'CORONA', 'LORENZETTI', 'HYDRA', 'DECA', 'DOCOL', 'TIGRE',
        'AMANCO', 'GERDAU', 'CSN', 'USIMINAS', 'VOTORANTIM', 'LAFARGEHOLCIM', 'INTERCEMENT',
        'SUVINIL', 'CORAL', 'SHERWIN WILLIAMS', 'MEGATON', 'BOSCH', 'DEWALT', 'MAKITA',
        'STANLEY', 'BLACK & DECKER', 'STIHL', 'HUSQVARNA', 'BRIGGS & STRATTON', 'HONDA',
        'TOYOTA', 'FORD', 'CHEVROLET', 'FIAT', 'VOLKSWAGEN', 'RENAULT', 'PEUGEOT', 'CITROEN',
        'HYUNDAI', 'KIA', 'MERCEDES-BENZ', 'BMW', 'AUDI', 'VOLVO', 'SCANIA', 'IVECO', 'MAN',
        'RANDON', 'MARCOPOLO', 'CAIO', 'MASCARELLO', 'NEOBUS', 'COMIL', 'EMBRAER', 'BOEING',
        'AIRBUS', 'BOMBARDIER', 'CESSNA', 'PIPER', 'BELL', 'SIKORSKY', 'ROBINSON', 'AGUSTAWESTLAND'
    ];
    for (const brand of commonBrands) {
        if (new RegExp(`\\b${brand}\\b`, 'i').test(upperText)) {
            return brand;
        }
    }
    const regexList = [
        /\b(?:marca\b|fabricante\b|fabr\b)\s*(?:\/modelo)?\s*[:=\-]?\s*([^;,\n\)\/\-]{2,50})/i,
        /\bmarca\b(?:\s+e\s+modelo)?\s+([^;,\n\)\/\-]{2,50})/i,
        /\bfabricado\s+por\s+([^;,\n\)\/\-]{2,50})/i
    ];
    for (const rx of regexList) {
        const m = rx.exec(upperText);
        if (m && m[1]) {
            return m[1].trim();
        }
    }
    return 'N/A';
};

const normalizeCnpjLocal = (val: string): string => {
    if (!val) return '';
    return val.replace(/\D/g, '').padStart(14, '0');
};

const executePncpSearchDirect = async (url: string, params: any, retries = 2) => {
    let directUrl = 'https://pncp.gov.br/api/search/';
    let directParams = { ...params };
    
    if (params.q?.includes('[Portal de Compras Públicas]')) {
        directParams.q = directParams.q ? `${directParams.q}` : '[Portal de Compras Públicas]';
    }
    
    const queryStr = serializePncpParams(directParams);
    const fullUrl = `${directUrl}?${queryStr}`;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await axios.get(fullUrl, {
                headers: {
                    'Accept': 'application/json, text/plain, */*'
                },
                timeout: 15000
            });
            return res;
        } catch (err: any) {
            const isCorsError = err.message?.includes('Network Error') || err.message?.includes('CORS') || err.code === 'ECONNABORTED';
            const isRateLimit = err.response?.status === 429;
            if (attempt < retries && (isCorsError || isRateLimit)) {
                const delay = (isRateLimit ? 2000 : 1000) * Math.pow(2, attempt);
                console.warn(`[PNCP Direct] Tentativa ${attempt + 1} falhou (${err.message}), re-tentando em ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw err;
        }
    }
};

const MAPA_SISTEMA_ORIGEM_NOMES: Record<number, string> = {
    1: 'Compras.gov.br',
    2: 'Licitações-e',
    3: 'SIGA',
    4: 'Compras SP - BEC',
    5: 'Compras RJ',
    6: 'Compras MG',
    7: 'Compras SC',
    8: 'Compras PR',
    9: 'Compras BA',
    10: 'Compras RS',
    11: 'Compras PE',
    12: 'BLL Compras',
    13: 'Banco do Brasil',
    14: 'Caixa Econômica Federal',
    15: 'Petrobras',
    16: 'Correios',
    17: 'FNDE',
    18: 'SES/PR',
    19: 'SES/RS',
    20: 'SES/SC',
    99: 'Portal Municipal',
    999: 'Portal de Compras Públicas'
};

const fetchPncpDetailDirect = async (cnpj: string, ano: string, sequencial: string) => {
    // V1 detail endpoint redireciona (301), usar proxy backend
    const consultaRes = await api.get(`/transparency/pncp-detail/${cnpj}/${ano}/${sequencial}`);
    const detailData: any = consultaRes.data || {};

    const itemsCountUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/quantidade`;
    const itemsListUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=100`;

    const [countRes, itemsRes] = await Promise.allSettled([
        axios.get(itemsCountUrl),
        axios.get(itemsListUrl)
    ]);

    const itemCount = countRes.status === 'fulfilled' ? countRes.value.data : 0;
    const itemsResponse = itemsRes.status === 'fulfilled' ? itemsRes.value.data : [];
    const items = Array.isArray(itemsResponse) ? itemsResponse : (itemsResponse.data || []);

    let hasMeEppBenefit = false;
    let minItemValue = Infinity;
    let maxItemValue = -Infinity;

    if (Array.isArray(items)) {
        items.forEach((item: any) => {
            if ([1, 2, 3].includes(item.tipoBeneficio)) {
                hasMeEppBenefit = true;
            }
            const val = item.valorUnitarioEstimado || (item.quantidade > 0 ? (item.valorTotalEstimado / item.quantidade) : 0) || 0;
            if (val > 0) {
                if (val < minItemValue) minItemValue = val;
                if (val > maxItemValue) maxItemValue = val;
            }
        });
    }

    return {
        data: {
            ...detailData,
            itemCount: itemCount || detailData.quantidadeItens || 0,
            hasMeEppBenefit,
            minItemValue: minItemValue === Infinity ? 0 : minItemValue,
            maxItemValue: maxItemValue === -Infinity ? 0 : maxItemValue,
            items: items
        }
    };
};

const fetchPncpArquivosDirect = async (cnpj: string, ano: string, sequencial: string) => {
    try {
        const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos?pagina=1&tamanhoPagina=100`;
        const res = await axios.get(url, { timeout: 10000 });
        const files = res.data || [];
        console.log(`[ARQUIVOS CORS] OK — ${files.length} arquivos via CORS direto`);
        const mappedFiles = files.map((f: any) => {
            const name = (f.titulo || f.nome_arquivo || '').toLowerCase();
            const isWinnerDoc = name.includes('proposta') || name.includes('habilitacao') || name.includes('vencedor') || name.includes('homologacao') || name.includes('ata');
            return { ...f, isWinnerDoc };
        });
        return { data: mappedFiles };
    } catch (e: any) {
        console.warn(`[ARQUIVOS CORS] Falhou — ${e.message}. Usando fallback backend proxy.`);
        return { data: [] };
    }
};

const fetchPncpItensCompletosDirect = async (cnpj: string, ano: string, sequencial: string) => {
    try {
        const urlItems = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=500`;
        const itemsRes = await axios.get(urlItems, { timeout: 10000 });
        const items = itemsRes.data || [];

        const detailedItems = await Promise.all(items.map(async (item: any) => {
            let vencedor = null;
            let marca = extractBrandLocal(item.descricao || item.description);
            
            try {
                const urlResult = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/${item.numeroItem}/resultados`;
                const rr = await axios.get(urlResult);
                if (rr.data && rr.data.length > 0) {
                    const winner = rr.data[0];
                    
                    vencedor = { 
                        nome: winner.nomeRazaoSocialFornecedor, 
                        cnpj: winner.niFornecedor, 
                        valor: winner.valorTotalHomologado,
                        marcaFornecedor: winner.marcaFornecedor,
                        modeloFornecedor: winner.modeloFornecedor,
                        empenhoUrl: `https://portaldatransparencia.gov.br/busca?termo=${normalizeCnpjLocal(winner.niFornecedor)}`,
                        empenhoDados: null
                    };
                    if (winner.marcaFornecedor) marca = winner.marcaFornecedor.toUpperCase().trim();
                }
            } catch (e) {}

            return {
                id: item.id,
                numero: item.numeroItem,
                descricao: item.descricao || item.description,
                quantidade: item.quantidade,
                valorUnitarioEstimado: item.valorUnitarioEstimado,
                valorTotalEstimado: item.valorTotalEstimado,
                situacao: item.situacaoItemNome,
                vencedor,
                marca,
                unidadeMedida: item.unidadeMedida
            };
        }));

        return { data: detailedItems };
    } catch {
        return { data: [] };
    }
};

// --- Helper: Safe ID Generation (Works in non-HTTPS/secure contexts) ---
const getPortalStyle = (fonte: string): { style: string; label: string } => {
    const map: Record<string, { style: string; label: string }> = {
        'Compras.gov.br': { style: 'bg-blue-500/10 text-blue-600 border-blue-500/20', label: 'COMPRAS.GOV' },
        'ComprasNet': { style: 'bg-blue-400/10 text-blue-600 border-blue-400/20', label: 'COMPRASNET' },
        'Licitações-e': { style: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20', label: 'LIC.E' },
        'Portal de Compras Públicas': { style: 'bg-orange-500/10 text-orange-600 border-orange-500/20', label: 'PCP' },
        'BLL Compras': { style: 'bg-purple-500/10 text-purple-600 border-purple-500/20', label: 'BLL' },
        'BEC SP': { style: 'bg-pink-500/10 text-pink-600 border-pink-500/20', label: 'BEC' },
        'Compras RJ': { style: 'bg-red-500/10 text-red-600 border-red-500/20', label: 'RJ' },
        'Compras MG': { style: 'bg-amber-500/10 text-amber-600 border-amber-500/20', label: 'MG' },
        'Compras SC': { style: 'bg-green-500/10 text-green-600 border-green-500/20', label: 'SC' },
        'Compras PR': { style: 'bg-lime-500/10 text-lime-600 border-lime-500/20', label: 'PR' },
        'Compras BA': { style: 'bg-teal-500/10 text-teal-600 border-teal-500/20', label: 'BA' },
        'Compras RS': { style: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20', label: 'RS' },
        'Compras PE': { style: 'bg-sky-500/10 text-sky-600 border-sky-500/20', label: 'PE' },
    };
    const lower = fonte.toLowerCase();
    for (const [key, val] of Object.entries(map)) {
        if (lower.includes(key.toLowerCase())) return val;
    }
    if (lower.includes('siga')) return { style: 'bg-red-500/10 text-red-600 border-red-500/20', label: 'SIGA' };
    if (lower.includes('portal ')) return { style: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', label: 'MUNIC' };
    return { style: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', label: fonte.toUpperCase().substring(0, 8) };
};

const generateSafeId = () => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {}
    
    // Fallback simple UUID v4 format
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const getStatusStyle = (situacao: string) => {
    const lower = (situacao || '').toLowerCase();
    if (lower.includes('divulgada')) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (lower.includes('suspensa')) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    if (lower.includes('encerrada') || lower.includes('revogada')) return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    return 'bg-secondary text-foreground border-border';
};

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
    itemCount?: number;
    hasMeEppBenefit?: boolean;
    minItemValue?: number;
    maxItemValue?: number;
    itens?: any[]; // Adicionado para cálculo rápido
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
const pncpRequestQueue: { cacheKey: string; item: PncpItem; resolve: (data: any) => void; reject: (err: any) => void; retries?: number }[] = [];
let activePncpRequests = 0;
const MAX_CONCURRENT_PNCP = 15;
const MAX_RETRIES_PER_ITEM = 10;

async function processPncpQueue() {
    if (activePncpRequests >= MAX_CONCURRENT_PNCP || pncpRequestQueue.length === 0) return;

    activePncpRequests++;
    const { cacheKey, item, resolve: origResolve, reject: origReject, retries = 0 } = pncpRequestQueue.shift()!;

    const tryFetch = async (): Promise<boolean> => {
        try {
            const parts = item.numero_controle_pncp?.split('-');
            const orgaoCnpj = item.orgao_cnpj || parts?.[0];
            const ano = (item as any).ano_compra || (item as any).ano || parts?.[1];
            const seq = (item as any).numero_compra || (item as any).numero_sequencial || parts?.[2];

            if (!orgaoCnpj || !ano || !seq) {
                throw new Error("Missing keys for PNCP detail");
            }

            let res;
            try {
                res = await fetchPncpDetailDirect(orgaoCnpj, ano, seq);
            } catch (directErr) {
                console.warn('[PNCP Direct] Falhou, tentando proxy backend:', directErr);
                res = await api.get(`/transparency/pncp-detail/${orgaoCnpj}/${ano}/${seq}`);
            }
            const detail = res.data;

            const result = {
                start: detail.dataRecebimentoProposta || detail.dataAberturaProposta || detail.dataHoraRegistroOcorrencia,
                end: detail.dataFimRecebimentoProposta || detail.dataEncerramentoProposta,
                valor: detail.valorTotalEstimado || detail.valor_global,
                itemCount: detail.itemCount,
                hasMeEppBenefit: detail.hasMeEppBenefit,
                minItemValue: detail.minItemValue,
                maxItemValue: detail.maxItemValue,
                itens: detail.items || [],
                usuarioNome: detail.usuarioNome || null,
                raw: detail
            };

            if (pncpDetailCache[cacheKey]) pncpDetailCache[cacheKey].data = result;
            window.dispatchEvent(new CustomEvent('pncp-cache-updated', { detail: { cacheKey } }));
            origResolve(result);
            return true;
        } catch (e: any) {
            if (e.response?.status === 404 || e.message?.includes('Missing keys')) {
                origResolve(null);
                return true;
            }
            console.warn(`[PNCP Worker] Failed for ${cacheKey} (tentativa ${retries+1}/${MAX_RETRIES_PER_ITEM}):`, e.message);
            if (pncpDetailCache[cacheKey]) delete pncpDetailCache[cacheKey].promise;
            if (retries < MAX_RETRIES_PER_ITEM) {
                pncpRequestQueue.push({ cacheKey, item, resolve: origResolve, reject: origReject, retries: retries + 1 });
            } else {
                origReject(e);
                return true;
            }
            return false;
        }
    };

    const done = await tryFetch();
    if (!done) {
        // Retry enqueued, trigger next item
        activePncpRequests--;
        setTimeout(processPncpQueue, 20);
        return;
    }

    // If this item succeeded or exhausted, clean up and process next
    activePncpRequests--;
    setTimeout(processPncpQueue, 20);
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

// Mapeamento de usuarioNome (fornecido pelo PNCP) para nome de portal
const MAPA_USUARIO_PORTAL: Record<string, string> = {
    'novo bbmnet licitações': 'BBMNET Licitações',
    'bbmnet licitações': 'BBMNET Licitações',
    'licitanet licitações eletrônicas ltda': 'Licitanet',
    'betha sistemas': 'Betha',
    'ipm sistemas': 'IPM',
    'e-customize consultoria em software s.a': 'ECustomize',
    'e customize consultoria em software s.a': 'ECustomize',
    'ecustomize consultoria em software s.a': 'ECustomize',
    's3 consultoria e sistemas ltda': 'S3',
    'rede geral serviços': 'Rede Geral',
    'br conectado': 'BR Conectado',
    'licitações-e bb': 'Licitações-e',
    'licitações e bb': 'Licitações-e',
    'governançabrasil tecnologia e gestão em serviços': 'Governança Brasil',
    'governancabrasil tecnologia e gestao em servicos': 'Governança Brasil',
    'bolsa nacional de compras - bnc': 'BNC',
    'system desenvolvimento de software': 'System',
    'centi': 'CENTI',
    'licita + brasil': 'Licita + Brasil',
    'compras.gov.br': 'Compras.gov.br',
};

// Componente reativo para badge de portal — auto-fetch + atualiza pelo cache
const PortalBadge = memo(({ item }: { item: any }) => {
    const parts = item.numero_controle_pncp?.split('-');
    const orgaoCnpj = item.orgao_cnpj || parts?.[0];
    const ano = (item as any).ano_compra || (item as any).ano || parts?.[1];
    const seq = (item as any).numero_compra || (item as any).numero_sequencial || parts?.[2];
    const cacheKey = `${orgaoCnpj}-${ano}-${seq}`;

    const [usuarioNome, setUsuarioNome] = useState<string | null>(() => {
        const cached = pncpDetailCache[cacheKey]?.data;
        const raw = cached?.usuarioNome || null;
        if (raw && raw !== 'undefined') return raw;
        return null;
    });

    // Auto-fetch se cache vazio
    useEffect(() => {
        if (!pncpDetailCache[cacheKey]?.data && !pncpDetailCache[cacheKey]?.promise) {
            queuePncpFetch(item).catch(() => {});
        }
    }, [cacheKey]);

    useEffect(() => {
        const handler = (e: Event) => {
            const ce = e as CustomEvent;
            if (ce.detail?.cacheKey === cacheKey) {
                const cached = pncpDetailCache[cacheKey]?.data;
                const raw = cached?.usuarioNome || null;
                if (raw && raw !== 'undefined') {
                    console.log(`[PORTAL BADGE] Atualizado: "${raw}"`);
                    setUsuarioNome(raw);
                }
            }
        };
        window.addEventListener('pncp-cache-updated', handler);
        return () => window.removeEventListener('pncp-cache-updated', handler);
    }, [cacheKey]);

    const isFetching = !pncpDetailCache[cacheKey]?.data && !!pncpDetailCache[cacheKey]?.promise;

    // Aplica mapeamento de nomes conhecidos
    const rawNome = usuarioNome || (item as any).fonte_dados || 'PNCP';
    const mappedNome = MAPA_USUARIO_PORTAL[rawNome.toLowerCase().trim()] || rawNome;
    const pair = getPortalStyle(mappedNome);
    return (
        <span title={rawNome} className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm border uppercase ${isFetching ? 'animate-pulse bg-gray-100 text-gray-400 border-gray-200' : pair.style}`}>
            {isFetching ? '...' : pair.label}
        </span>
    );
});

const ProposalDates = memo(({ item }: { item: PncpItem }) => {
    // Usar datas nativas da listagem se disponíveis, caso contrário mostrar traço
    const formatNativeDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        } catch {
            return '-';
        }
    };

    return (
        <td className="px-4 py-3.5 align-top text-[11px] font-medium text-destructive">
            {formatNativeDate(item.data_encerramento_proposta || item.data_fim_vigencia)}
        </td>
    );
});
const PncpValue = memo(({ item, isMobile = false }: { item: PncpItem; isMobile?: boolean }) => {
    const parts = item.numero_controle_pncp?.split('-');
    const orgaoCnpj = item.orgao_cnpj || parts?.[0];
    const ano = (item as any).ano_compra || (item as any).ano || parts?.[1];
    const seq = (item as any).numero_compra || (item as any).numero_sequencial || parts?.[2];
    const cacheKey = `${orgaoCnpj}-${ano}-${seq}`;

    const [detail, setDetail] = useState<any>(() => {
        const cached = localStorage.getItem(`pncp_detail_${cacheKey}`);
        if (cached) {
            try { return JSON.parse(cached); } catch { return null; }
        }
        return pncpDetailCache[cacheKey]?.data || null;
    });
    
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { threshold: 0.1 });

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [cacheKey]);

    useEffect(() => {
        const hasInitialValue = (item.valorTotalEstimado || item.valor_global || 0) > 0;
        if (isVisible && !detail && !hasInitialValue) {
            queuePncpFetch(item).then(res => {
                if (res) safeSetPncpDetail(cacheKey, res);
            }).catch(() => {});
        }

        const handleUpdate = (e: any) => {
            if (e.detail.cacheKey === cacheKey) {
                const newData = pncpDetailCache[cacheKey]?.data || null;
                setDetail(newData);
                if (newData) safeSetPncpDetail(cacheKey, newData);
            }
        };

        window.addEventListener('pncp-cache-updated', handleUpdate as any);
        return () => window.removeEventListener('pncp-cache-updated', handleUpdate as any);
    }, [cacheKey, item, detail, isVisible]);

    // Lógica de Cálculo em Tempo Real (Solicitado pelo Usuário)
    const valorOficial = detail?.valor || item.valorTotalEstimado || item.valor_global;

    const valorCalculado = useMemo(() => {
        const itemsToSum = detail?.itens || item.itens; // Tenta pegar itens do detalhe ou do objeto base (se houver)
        if (!itemsToSum || !Array.isArray(itemsToSum) || itemsToSum.length === 0) return null;
        
        return itemsToSum.reduce((acc: number, it: any) => {
            const vUnit = it.valorUnitarioEstimated || it.valorUnitarioEstimado || it.valorUnitario || 0;
            const qtd = it.quantidade || 0;
            return acc + (vUnit * qtd);
        }, 0);
    }, [detail, item]);

    const finalValue = valorOficial || valorCalculado;
    const isCalculated = !valorOficial && !!valorCalculado;
    const isLoading = !finalValue && pncpDetailCache[cacheKey]?.promise;

    if (isMobile) {
        return (
            <div ref={containerRef} className="flex flex-col items-end gap-1 shrink-0">
                <div className={`flex flex-col items-end gap-0.5`}>
                    <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded border shadow-sm ${
                        isLoading 
                        ? 'animate-pulse bg-gray-100 text-gray-400 border-gray-200' 
                        : isCalculated
                            ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                            : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                        <DollarSign className="h-2.5 w-2.5" />
                        <span>{finalValue ? finalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : (isLoading ? 'Calculando...' : 'V. não inf.')}</span>
                    </div>
                    {isCalculated && <span className="text-[7px] font-black text-amber-500 uppercase tracking-tighter">Soma de Itens</span>}
                </div>
            </div>
        );
    }

    return (
        <td ref={containerRef} className="px-4 py-3.5 align-top text-right min-w-[140px]">
            <div className="flex flex-col items-end gap-1">
                <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${
                    isLoading 
                    ? 'animate-pulse bg-gray-100 text-gray-400 border-gray-200' 
                    : isCalculated
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                        : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                }`}>
                    <DollarSign className="h-3 w-3" />
                    <span>{finalValue ? finalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : (isLoading ? 'Somando itens...' : 'V. não inf.')}</span>
                </div>
                {isCalculated && (
                    <motion.span 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[8px] font-black text-amber-500 bg-amber-500/5 px-1 rounded uppercase tracking-tighter border border-amber-500/10"
                    >
                        Total Calculado
                    </motion.span>
                )}
            </div>
        </td>
    );
});

const PncpBadgeStatus = memo(({ item }: { item: PncpItem }) => {
    const parts = item.numero_controle_pncp?.split('-');
    const orgaoCnpj = item.orgao_cnpj || parts?.[0];
    const ano = (item as any).ano_compra || (item as any).ano || parts?.[1];
    const seq = (item as any).numero_compra || (item as any).numero_sequencial || parts?.[2];
    const cacheKey = `${orgaoCnpj}-${ano}-${seq}`;
    
    const [detail, setDetail] = useState(() => {
        const cached = localStorage.getItem(`pncp_detail_${cacheKey}`);
        if (cached) {
            try { return JSON.parse(cached); } catch { return null; }
        }
        return pncpDetailCache[cacheKey]?.data || null;
    });

    const [isVisible, setIsVisible] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { threshold: 0.1 });

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [cacheKey]);

    useEffect(() => {
        const hasInitialExtra = item.itemCount !== undefined || item.hasMeEppBenefit !== undefined;
        if (isVisible && !detail && !hasInitialExtra) {
            queuePncpFetch(item).then(res => {
                if (res) safeSetPncpDetail(cacheKey, res);
            }).catch(() => {});
        }

        const handleUpdate = (e: any) => {
            if (e.detail.cacheKey === cacheKey) {
                const newData = pncpDetailCache[cacheKey]?.data || null;
                setDetail(newData);
                if (newData) safeSetPncpDetail(cacheKey, newData);
            }
        };

        window.addEventListener('pncp-cache-updated', handleUpdate as any);
        return () => window.removeEventListener('pncp-cache-updated', handleUpdate as any);
    }, [cacheKey, item, detail, isVisible]);

    const itemCount = detail?.itemCount || item.itemCount;
    const hasMeEppBenefit = detail?.hasMeEppBenefit || item.hasMeEppBenefit;
    const isLoading = itemCount === undefined && pncpDetailCache[cacheKey]?.promise;

    return (
        <div ref={containerRef} className="flex flex-col gap-1.5 min-w-[120px]">
             <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold border truncate ${getStatusStyle(item.situacao_nome)}`}>
                {item.situacao_nome}
            </span>
            <div className="flex flex-wrap gap-1">
                {isLoading ? (
                    <span className="px-1.5 py-0.5 bg-muted animate-pulse text-muted-foreground border border-border/50 rounded text-[9px] font-medium uppercase flex items-center gap-1 shadow-sm">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        Itens...
                    </span>
                ) : (
                    itemCount !== undefined && itemCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded text-[9px] font-black uppercase flex items-center gap-1 shadow-sm transition-all hover:bg-indigo-500/20">
                            <Package className="h-2.5 w-2.5" />
                            {itemCount} Itens
                        </span>
                    )
                )}
                
                {hasMeEppBenefit && !isLoading && (
                    <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded text-[9px] font-black uppercase flex items-center gap-1 shadow-sm">
                        <Award className="h-2.5 w-2.5" />
                        ME/EPP
                    </span>
                )}
            </div>
        </div>
    );
});

// Helper: localStorage com proteção contra QuotaExceededError
const safeSetPncpDetail = (cacheKey: string, data: any) => {
    try {
        localStorage.setItem(`pncp_detail_${cacheKey}`, JSON.stringify(data));
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.warn('[PNCP Cache] localStorage cheio, limpando entradas antigas...');
            const keys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k?.startsWith('pncp_detail_')) keys.push(k);
            }
            // Remove metade das entradas mais antigas
            keys.sort((a, b) => {
                const aData = localStorage.getItem(a);
                const bData = localStorage.getItem(b);
                const aTime = aData ? JSON.parse(aData).cachedAt || 0 : 0;
                const bTime = bData ? JSON.parse(bData).cachedAt || 0 : 0;
                return aTime - bTime;
            });
            const toRemove = Math.ceil(keys.length / 2);
            for (let i = 0; i < toRemove && i < keys.length; i++) {
                localStorage.removeItem(keys[i]);
            }
            // Salva com cachedAt para controle futuro
            try {
                localStorage.setItem(`pncp_detail_${cacheKey}`, JSON.stringify({ ...data, cachedAt: Date.now() }));
            } catch {}
        } else {
            console.warn('[PNCP Cache] Erro ao salvar no localStorage:', e.message);
        }
    }
};

export default function OportunidadesSearch() {
    const location = useLocation();
    const [keyword, setKeyword] = useState(location.state?.openPncpId || '');
    const [statusFilter, setStatusFilter] = useState('recebendo_proposta'); // Default = A Receber Propostas
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
    const [fonteFilter, setFonteFilter] = useState<string[]>(['unificado']); // Multi-seleção de Portais

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    // --- WAF Cookie Bypass Solver Hook ---
    useEffect(() => {
        if ((window as any).electronAPI?.isDesktop) {
            console.log("[PNCP WAF Solver] Mount hidden iframe for F5 challenge cookies...");
            const iframe = document.createElement('iframe');
            iframe.src = 'https://pncp.gov.br/';
            iframe.style.display = 'none';
            iframe.style.width = '0px';
            iframe.style.height = '0px';
            document.body.appendChild(iframe);
            
            return () => {
                try {
                    document.body.removeChild(iframe);
                } catch (e) {}
            };
        }
    }, []);

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
        setStatusFilter('recebendo_proposta');
        setDataInicialFilter('');
        setDataFinalFilter('');
        setValorMinFilter('');
        setValorMaxFilter('');
        setFonteFilter(['unificado']);
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

    // Dados do endpoint de portal (captcha) - dataEncerramentoProposta, linkSistemaOrigem, etc
    const [portalData, setPortalData] = useState<any>(null);
    const [loadingPortal, setLoadingPortal] = useState(false);
    
    const [previewEmpenhoUrl, setPreviewEmpenhoUrl] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    
    // Novo Estado para Controle de Exportação Blindada
    const [isExporting, setIsExporting] = useState(false);

    // Estado para Visualização Universal de Arquivos PNCP
    const [previewData, setPreviewData] = useState<{ isOpen: boolean; url: string; name: string; type?: string }>({
        isOpen: false,
        url: '',
        name: '',
    });

    const getPortalLoginUrl = useCallback((item: PncpItem) => {
        if (!item) return '#';
        const fonte = (item as any).fonte_dados || 'PNCP';
        const urlLower = (item.item_url || '').toLowerCase();
        
        // 1. Portais Nacionais Consolidados
        if (fonte === 'Compras.gov.br' || urlLower.includes('compras.gov.br') || urlLower.includes('comprasnet.gov.br')) {
            return 'https://www.gov.br/compras/pt-br/acesso-a-sistemas';
        }
        if (fonte === 'BLL Compras' || urlLower.includes('bll')) {
            return 'https://bllcompras.com/Home/Login';
        }
        if (fonte === 'Portal de Compras Públicas' || urlLower.includes('portaldecompraspublicas')) {
            return 'https://www.portaldecompraspublicas.com.br/login';
        }
        if (fonte === 'Licitações-e' || urlLower.includes('licitacoes-e')) {
            return 'https://www.licitacoes-e.com.br/aop/login.jsp';
        }

        // 2. Heurísticas Específicas por UF ou Domínio
        if (fonte.includes('SIGA') || urlLower.includes('siga.pr.gov.br') || urlLower.includes('siga.df.gov.br')) {
            return urlLower.includes('df.gov.br') ? 'https://www.siga.df.gov.br/login' : 'https://www.siga.pr.gov.br/login';
        }
        if (fonte.includes('RS') || urlLower.includes('rs.gov.br') || urlLower.includes('compras.rs')) {
            return 'https://www.compras.rs.gov.br/login';
        }
        if (fonte.includes('SC') || urlLower.includes('sc.gov.br') || urlLower.includes('compras.sc')) {
            return 'https://www.compras.sc.gov.br/login';
        }
        if (fonte.includes('MG') || urlLower.includes('mg.gov.br') || urlLower.includes('compras.mg')) {
            return 'https://www.compras.mg.gov.br/login';
        }
        if (fonte.includes('SP') || urlLower.includes('sp.gov.br') || urlLower.includes('bec.sp')) {
            return 'https://www.bec.sp.gov.br/';
        }
        if (fonte.includes('RJ') || urlLower.includes('rj.gov.br') || urlLower.includes('compras.rj')) {
            return 'https://www.compras.rj.gov.br/login';
        }
        if (fonte.includes('PR') || urlLower.includes('pr.gov.br') || urlLower.includes('comprasweb.pr')) {
            return 'https://www.comprasweb.pr.gov.br/login';
        }
        
        // 3. Fallback Dinâmico: Extrai o domínio base de URLs externas
        if (urlLower.startsWith('http') && !urlLower.includes('pncp.gov.br')) {
            try {
                const urlObj = new URL(item.item_url);
                return `${urlObj.protocol}//${urlObj.hostname}`;
            } catch {
                // fallback normal
            }
        }
        
        return 'https://pncp.gov.br/app/editais';
    }, []);

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

            // 1. Fetch Files (direto no PNCP - CORS * permite qualquer browser)
            setLoadingFiles(true);
            try {
                let res;
                try {
                    res = await fetchPncpArquivosDirect(cnpj, ano, seq);
                } catch {
                    res = await api.get(`/transparency/licitacoes/${cnpj}/${ano}/${seq}/arquivos`);
                }
                setSelectedItemFiles(res.data || []);
                setSelectedFilesToExport(res.data || []);
            } catch (e) {
                console.error("Failed to fetch files", e);
            } finally {
                setLoadingFiles(false);
            }

            // 2. Fetch Full Items (direto no PNCP - CORS * permite qualquer browser)
            setLoadingFullItems(true);
            try {
                let res;
                try {
                    res = await fetchPncpItensCompletosDirect(cnpj, ano, seq);
                } catch {
                    res = await api.get(`/transparency/licitacoes/${cnpj}/${ano}/${seq}/itens-completos`, {
                        params: { termo: keyword }
                    });
                }
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

            // 4. Fetch Portal Data (com captcha) - dataEncerramentoProposta, linkSistemaOrigem
            setLoadingPortal(true);
            try {
                const portal = await fetchPncpPortalDirect(cnpj, ano, seq);
                setPortalData(portal);
            } catch (e: any) {
                console.warn("[Portal] Não foi possível obter dados do portal (captcha):", e.message);
                setPortalData(null);
            } finally {
                setLoadingPortal(false);
            }
        };

        fetchDetails();
    }, [selectedItem]);

    // Reset portalData quando fecha o detalhe
    useEffect(() => {
        if (!selectedItem) setPortalData(null);
    }, [selectedItem]);

    // --- Kanban Export States ---
    // --- Kanban Export States ---
    const folders = useKanbanStore(state => state?.folders) || [];
    const boards = useKanbanStore(state => state?.boards) || [];
    const lists = useKanbanStore(state => state?.lists) || [];
    const cards = useKanbanStore(state => state?.cards) || [];
    const allMembers = useKanbanStore(state => state?.members);
    const currentUser = (allMembers || [])[0] || null;

    // Sincronização automática com Kanban ao entrar na tela para garantir marcação de "Já Importado"
    const fetchKanbanData = useKanbanStore(state => state.fetchKanbanData);
    useEffect(() => {
        fetchKanbanData();
    }, [fetchKanbanData]);

    // OTIMIZAÇÃO v3.5.51: Cria um índice (Set) para busca instantânea de itens importados
    const importedPncpIds = useMemo(() => {
        const set = new Set<string>();
        cards.forEach(c => {
            if (c.pncpId) set.add(c.pncpId.trim().toLowerCase());
        });
        return set;
    }, [cards]);

    const importedLinks = useMemo(() => {
        const set = new Set<string>();
        cards.forEach(c => {
            if (c.customLink) set.add(c.customLink.trim().toLowerCase());
        });
        return set;
    }, [cards]);

    const isAlreadyInKanban = useCallback((item: PncpItem) => {
        if (!item) return false;
        const pncpId = (item.numero_controle_pncp || item.orgao_cnpj || '').trim().toLowerCase();
        const itemUrl = (item.item_url || '').trim().toLowerCase();
        
        // Busca Instantânea por ID
        if (pncpId && importedPncpIds.has(pncpId)) return true;
        
        // Busca Instantânea por Link (mais flexível)
        if (itemUrl) {
            // Verifica se algum link importado contém a URL do item
            for (const link of Array.from(importedLinks)) {
                if (link.includes(itemUrl)) return true;
            }
        }
        
        return false;
    }, [importedPncpIds, importedLinks]);
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [directExportItem, setDirectExportItem] = useState<PncpItem | null>(null);
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

    const handleExportToKanban = async () => {
        const newErrors: Record<string, boolean> = {};
        if (!exportFolderId) newErrors.folder = true;
        if (!exportBoardId) newErrors.board = true;
        if (!exportListId) newErrors.list = true;

        if (Object.keys(newErrors).length > 0) {
            setExportErrors(newErrors);
            toast.error("Por favor, selecione o destino completo para exportação.");
            return;
        }

        const exportTarget = directExportItem || selectedItem;
        if (!exportTarget) return;

        setIsExporting(true);
        
        // Otimização v3.5.99.2: Garantir ID único mesmo para itens sem numero_controle_pncp (ex: BLL)
        const exportId = exportTarget.numero_controle_pncp || 
                         `${exportTarget.orgao_cnpj}-${(exportTarget as any).ano || new Date().getFullYear()}-${(exportTarget as any).numero_sequencial || exportTarget.id || Math.random().toString(36).substring(7)}`;

        try {
            // --- BLINDAGEM v2.2: Busca reativa de dados faltantes ---
            let finalFiles = selectedItemFiles;
            let finalItems = fullItems;
            let finalDetail = itemDetail;

            // Se os dados atuais no estado não forem do item que estamos exportando, buscamos agora
            const isDataConsistent = selectedItem?.numero_controle_pncp === exportId;
            
            if (!isDataConsistent || selectedItemFiles.length === 0 || fullItems.length === 0) {
                const ano = (exportTarget as any).ano_compra || (exportTarget as any).ano;
                const seq = (exportTarget as any).numero_compra || (exportTarget as any).numero_sequencial;
                const cnpj = exportTarget.orgao_cnpj;

                if (cnpj && ano && seq) {
                    toast.info("Capturando anexos e itens do PNCP...");
                    
                    const [filesRes, itemsRes, detailData] = await Promise.all([
                        fetchPncpArquivosDirect(cnpj, ano, seq).catch(() =>
                            api.get(`/transparency/licitacoes/${cnpj}/${ano}/${seq}/arquivos`).catch(() => ({ data: [] }))
                        ),
                        fetchPncpItensCompletosDirect(cnpj, ano, seq).catch(() =>
                            api.get(`/transparency/licitacoes/${cnpj}/${ano}/${seq}/itens-completos`, { params: { termo: keyword } }).catch(() => ({ data: [] }))
                        ),
                        queuePncpFetch(exportTarget).catch(() => null)
                    ]);

                    finalFiles = filesRes.data || [];
                    finalItems = itemsRes.data || [];
                    finalDetail = detailData?.raw || null;
                }
            }

            const board = boards.find(b => b.id === exportBoardId);
            if (!board) {
                toast.error("Quadro de destino não encontrado. Tente selecionar novamente.");
                setIsExporting(false);
                return;
            }

            const itemAny = exportTarget as any;
            const detailAny = finalDetail as any;
            
            let estimatedValue = 
                detailAny?.valorTotalEstimado || 
                itemAny.valorTotalEstimado || 
                itemAny.valor_global || 
                itemAny.valor ||
                0;

            // Se o valor estimado for 0 ou ausente, calcula a partir dos itens
            if (estimatedValue <= 0 && finalItems && Array.isArray(finalItems) && finalItems.length > 0) {
                estimatedValue = finalItems.reduce((acc: number, it: any) => {
                    const vTotal = it.valorTotalEstimado || (Number(it.valorUnitarioEstimado || it.valorUnitario || it.valorUnitarioEstimated || 0) * Number(it.quantidade || 0));
                    return acc + Number(vTotal || 0);
                }, 0);
            }

            // Formatação Rica do Markdown
            const descriptionMD = `
**[GOV.BR] Oportunidade PNCP mapeada pelo Polaryon**
---
**Órgão Licitante:** ${exportTarget.orgao_nome}
**CNPJ:** ${exportTarget.orgao_cnpj}
**Unidade Compradora:** ${exportTarget.unidade_nome || 'N/A'} (Cód: ${exportTarget.unidade_codigo || '-'})
**Localidade:** ${exportTarget.municipio_nome} - ${exportTarget.uf}
**Modalidade:** ${exportTarget.modalidade_licitacao_nome}
**Instrumento:** ${exportTarget.tipo_instrumento_convocacao_nome || '-'}
**SRP (Registro de Preços):** ${exportTarget.srp ? 'Sim' : 'Não'}
**Amparo Legal:** ${exportTarget.amparo_legal_nome || 'N/A'}
**Valor Estimado:** ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estimatedValue)}
**Datas do Edital:** Publicação PNCP (${exportTarget.data_publicacao_pncp ? new Date(exportTarget.data_publicacao_pncp).toLocaleDateString('pt-BR') : '-'}) • **Atualização:** ${exportTarget.data_atualizacao_pncp ? new Date(exportTarget.data_atualizacao_pncp).toLocaleDateString('pt-BR') : '-'}
**Encerramento de Propostas:** ${exportTarget.data_fim_vigencia ? new Date(exportTarget.data_fim_vigencia).toLocaleDateString('pt-BR') : '-'}

### Objeto:
${exportTarget.description || exportTarget.title}

### Arquivos Anexos:
${finalFiles.length > 0 ? finalFiles.map((f: any) => `- [${f.titulo} (${f.tipoDocumentoNome})](${f.url})`).join('\n') : '*Nenhum arquivo capturado automaticamente.*'}

[🔗 Acessar Edital Oficial Completo no PNCP](${getOfficialLink(exportTarget)})
            `.trim();

            const formattedValue = estimatedValue > 0 
                ? `  ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estimatedValue)}` 
                : '';

            const cardParams = {
                title: `${exportTarget.title}${formattedValue}`,
                summary: exportTarget.description || exportTarget.title || "Oportunidade importada do GovBr",
                description: descriptionMD,
                listId: exportListId,
                position: 0,
                labels: [],
                assignee: null,
                completed: false,
                archived: false,
                trashed: false,
                customLink: getOfficialLink(exportTarget),
            };

            // Inject Attachments
            const cardAttachments: any[] = [];
            for (const file of finalFiles) {
                cardAttachments.push({
                    id: generateSafeId(),
                    name: file.titulo || file.tipoDocumentoNome,
                    url: file.url,
                    type: "pdf", 
                    addedAt: new Date().toISOString()
                });
            }

            // Inject Items
            const cardItems: any[] = [];
            if (finalItems && finalItems.length > 0) {
                finalItems.forEach((item: any) => {
                    cardItems.push({
                        id: generateSafeId(),
                        name: item.descricao || "Item sem descrição",
                        unitValue: item.valorUnitarioEstimado || 0,
                        quantity: item.quantidade || 1
                    });
                });
            }

            // Create Milestones
            const endDateTime = finalDetail?.dataFimRecebimentoProposta || 
                              finalDetail?.dataEncerramentoProposta || 
                              exportTarget.data_encerramento_proposta ||
                              exportTarget.data_fim_vigencia;
            const cardMilestones: any[] = [];

            if (endDateTime) {
                const d = new Date(endDateTime);
                if (!isNaN(d.getTime())) {
                    cardMilestones.push({
                        id: generateSafeId(),
                        title: "LANCES",
                        dueDate: d.toISOString().split('T')[0],
                        hour: d.toTimeString().split(' ')[0].substring(0, 5),
                        completed: false
                    });
                }
            }

            const newCardData = {
                id: generateSafeId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                comments: [],
                attachments: cardAttachments,
                items: cardItems,
                checklist: [],
                timeEntries: [],
                milestones: cardMilestones,
                descriptionEntries: [],
                pncpId: exportId,
                ...cardParams
            };

            useKanbanStore.setState(state => ({
                cards: [newCardData, ...state.cards] 
            }));

            if (socketService) {
                socketService.emit('system_action', { 
                    store: 'KANBAN', 
                    type: 'ADD_CARD', 
                    payload: newCardData 
                });
            }

            await api.post('/kanban/cards', newCardData);

            localStorage.setItem('POLARYON_LAST_EXPORT_FOLDER', exportFolderId);
            localStorage.setItem('POLARYON_LAST_EXPORT_BOARD', exportBoardId);
            localStorage.setItem('POLARYON_LAST_EXPORT_LIST', exportListId);

            toast.success("Oportunidade exportada com sucesso!");
            setIsExportDialogOpen(false);
        } catch (e) {
            console.error("Export failed", e);
            toast.error("Falha na exportação. Verifique sua conexão.");
        } finally {
            setIsExporting(false);
        }
    };

    const fetchOportunidades = useCallback(async (currentPage = 1) => {
        setLoading(true);
        setError('');
        setLoadingMessage('');
        try {
            const formatToApiDate = (dateStr: string) => {
                if (!dateStr) return '';
                return dateStr.replace(/-/g, '');
            };

            const buildParams = (p: number) => {
                const params: any = {
                    tam_pagina: 50,
                    pagina: p
                };
                if (keyword.trim()) params.q = keyword.trim();
                // Quando filtro de data está ativo, busca em TODOS os status
                // (itens com data_fim_vigencia passada estão em status encerradas)
                const hasDateFilterLocal = !!(dataInicialFilter || dataFinalFilter);
                const fallbackStatus = 'recebendo_proposta,propostas_encerradas,encerradas,suspensas,canceladas';
                const statusVals = hasDateFilterLocal ? fallbackStatus.split(',') : (statusFilter || fallbackStatus).split(',').filter(Boolean);
                params.status = statusVals;
                const fallbackDocumentos = 'edital,aviso_contratacao_direta,ata,contrato';
                const docVals = (instrumentoFilter || fallbackDocumentos).split(',').filter(Boolean);
                params.tipos_documento = docVals;
                if (ufFilter) params.ufs = [ufFilter];
                if (esferaFilter) params.esferas = [esferaFilter];
                if (modalidadeFilter) {
                    const modMap: Record<string, string[]> = {
                        'Pregão': ['6', '7', '18', '19'],
                        'Dispensa': ['8'],
                        'Concorrência': ['4', '5', '16', '17'],
                        'Inexigibilidade': ['9']
                    };
                    if (modMap[modalidadeFilter]) params.modalidades = modMap[modalidadeFilter];
                }
                if (ordenacaoFilter) params.ordenacao = ordenacaoFilter;

                // Envia data para API (PNCP ignora, mas enviamos por completude)
                // Filtragem real é client-side usando data_encerramento_proposta
                if (dataInicialFilter || dataFinalFilter) {
                    if (dataInicialFilter) params.data_publicacao_inicial = formatToApiDate(dataInicialFilter);
                    if (dataFinalFilter) params.data_publicacao_final = formatToApiDate(dataFinalFilter);
                }

                return params;
            };

            const MAPA_FONTE_Q: Record<string, string> = {
                'bll': 'Bolsa Licitações',
                'licitacoese': 'Licitações-e',
                'siga': 'SIGA',
                'compras-rs': 'Compras RS',
                'pcp': '[Portal de Compras Públicas]',
                'bnc': 'Bolsa Nacional de Compras',
                'ecustomize': 'ECustomize',
            };

            const isAll = fonteFilter.includes('unificado');
            const kw = keyword.trim();
            const searchParams = buildParams(currentPage);

            const hasDateFilter = !!(dataInicialFilter || dataFinalFilter);
            // Quando tem data, precisamos buscar MAIS páginas para ter dados suficientes
            // pois a API do PNCP ignora o filtro de data e precisamos filtrar client-side
            const numPages = hasDateFilter ? 10 : 2;
            const startPage = hasDateFilter ? (currentPage - 1) * 10 + 1 : (currentPage - 1) * 2 + 1;

            // Determinar quais consultas fazemos
            const activeQueries: { key: string; type: 'pcp' | 'pncp-search'; q_extra?: string }[] = [];

            if (isAll) {
                activeQueries.push({ key: 'pncp_geral', type: 'pncp-search' });
            } else {
                const NEW_PORTAL_IDS = new Set(['ipm', 'betha', 'bbmnet', 'licitanet', 'brconectado', 'governancabrasil', 'licitamais', 'centi', 'systemdesenv', 'pncp', 'comprasnet']);
                if (fonteFilter.includes('comprasnet') || fonteFilter.includes('pncp') || fonteFilter.some(f => NEW_PORTAL_IDS.has(f))) {
                    activeQueries.push({ key: 'pncp_geral', type: 'pncp-search' });
                }
                // Para portais específicos, usa keyword injection + filtragem client-side
                for (const f of fonteFilter) {
                    if (f === 'unificado' || f === 'pncp' || f === 'comprasnet') continue;
                    const qExtra = MAPA_FONTE_Q[f];
                    if (qExtra) {
                        activeQueries.push({ key: f, type: 'pncp-search', q_extra: qExtra });
                    }
                }
            }

            let items: any[] = [];
            let total = 0;

            if (activeQueries.length > 0) {
                const fetchPromises: Promise<{ key: string; page: number; items: any[]; total: number }>[] = [];

                activeQueries.forEach(qInfo => {
                    for (let p = startPage; p < startPage + numPages; p++) {
                        const params: any = { ...searchParams, pagina: p, tam_pagina: 50 };
                        
                        if (qInfo.q_extra) {
                            params.q = kw ? `${kw} ${qInfo.q_extra}` : qInfo.q_extra;
                        }

                        // Tenta chamada direta ao PNCP primeiro, fallback backend proxy
                        const url = '/transparency/pncp-proxy';
                        const promise = executePncpSearchDirect(url, params)
                            .catch(() => api.get(url, { params }))
                            .then(res => {
                                const itemsData = res.data?.items || [];
                                const totalVal = res.data?.total || 0;
                                
                                return {
                                    key: qInfo.key,
                                    page: p,
                                    items: itemsData,
                                    total: totalVal
                                };
                            })
                            .catch(() => {
                                return {
                                    key: qInfo.key,
                                    page: p,
                                    items: [],
                                    total: 0
                                };
                            });
                            
                        fetchPromises.push(promise);
                    }
                });

                const resultsList = await Promise.all(fetchPromises);

                const allItems = resultsList.flatMap(r => r.items);
                
                // Soma dos totais reportados por cada query ativa
                const totalsMap = new Map<string, number>();
                resultsList.forEach(r => {
                    if (r.page === startPage) {
                        totalsMap.set(r.key, r.total);
                    }
                });

                totalsMap.forEach((val) => {
                    total += val;
                });

                // Deduplicação dos itens
                const uniqueMap = new Map();
                allItems.forEach(item => {
                    const cnpj = item.orgao_cnpj || '';
                    const ano = (item as any).ano || (item as any).ano_compra || '';
                    const seq = (item as any).numero_sequencial || (item as any).numero_compra || '';
                    const key = item.numero_controle_pncp || `${cnpj}-${ano}-${seq}` || item.id;
                    
                    if (!uniqueMap.has(key)) {
                        uniqueMap.set(key, item);
                    } else {
                        uniqueMap.set(key, { ...uniqueMap.get(key), ...item });
                    }
                });
                
                items = Array.from(uniqueMap.values());
                if (total === 0) {
                    total = items.length;
                }
            }

            items = items.map((i: any) => {
                const descLower = (i.description || '').toLowerCase();
                const titleLower = (i.title || '').toLowerCase();
                const orgaoLower = (i.orgao_nome || '').toLowerCase();
                const urlLower = (i.item_url || '').toLowerCase();
                
                // Extract domain from item_url for domain-based identification
                let domain = '';
                try {
                    if (i.item_url) domain = new URL(i.item_url).hostname.replace('www.', '');
                } catch {}
                
                // Portal identification:
                // 1. sistema_origem_id (always empty in search API, but keep for future)
                // 2. Domain mapping from item_url
                // 3. URL/orgão heuristics
                // 4. Fallback: PNCP
                let sid = i.sistema_origem_id || i.id_sistema_origem;
                let fonteLabel = (sid && MAPA_SISTEMA_ORIGEM_NOMES[sid]) || null;
                
                // Domain → portal name mapping
                const DOMAIN_PORTAL_MAP: Record<string, string> = {
                    'compras.gov.br': 'Compras.gov.br',
                    'comprasnet.gov.br': 'Compras.gov.br',
                    'portaldecompraspublicas.com.br': 'Portal de Compras Públicas',
                    'bll.com.br': 'BLL Compras',
                    'bllcomp.com.br': 'BLL Compras',
                    'licitacoes-e.com.br': 'Licitações-e',
                    'siga.pr.gov.br': 'SIGA',
                    'siga.df.gov.br': 'SIGA',
                    'compras.rs.gov.br': 'Compras RS',
                    'bec.sp.gov.br': 'BEC SP',
                    'compras.rj.gov.br': 'Compras RJ',
                    'compras.mg.gov.br': 'Compras MG',
                    'compras.sc.gov.br': 'Compras SC',
                    'compras.pr.gov.br': 'Compras PR',
                    'compras.ba.gov.br': 'Compras BA',
                    'compras.pe.gov.br': 'Compras PE',
                    'bbmnet.licitacoes.com': 'BBMNET Licitações',
                    'novo.bbmnet.licitacoes.com': 'BBMNET Licitações',
                };

                if (!fonteLabel) {
                    fonteLabel = DOMAIN_PORTAL_MAP[domain] || null;
                }
                
                if (!fonteLabel) {
                    if (urlLower.includes('comprasnet') || urlLower.includes('compras.gov.br')) {
                        fonteLabel = 'Compras.gov.br';
                    } else if (urlLower.includes('portaldecompraspublicas')) {
                        fonteLabel = 'Portal de Compras Públicas';
                    } else if (urlLower.includes('bll')) {
                        fonteLabel = 'BLL Compras';
                    } else if (urlLower.includes('licitacoes-e')) {
                        fonteLabel = 'Licitações-e';
                    } else if (urlLower.includes('siga.pr') || urlLower.includes('siga.df')) {
                        fonteLabel = 'SIGA';
                    } else if (urlLower.includes('compras.rs')) {
                        fonteLabel = 'Compras RS';
                    } else if (urlLower.includes('bec.sp')) {
                        fonteLabel = 'BEC SP';
                    } else if (urlLower.includes('compras.rj')) {
                        fonteLabel = 'Compras RJ';
                    } else if (urlLower.includes('compras.mg')) {
                        fonteLabel = 'Compras MG';
                    } else if (urlLower.includes('compras.sc')) {
                        fonteLabel = 'Compras SC';
                    } else if (urlLower.includes('comprasweb.pr') || urlLower.includes('compras.pr')) {
                        fonteLabel = 'Compras PR';
                    } else if (urlLower.includes('compras.ba')) {
                        fonteLabel = 'Compras BA';
                    } else if (urlLower.includes('compras.pe')) {
                        fonteLabel = 'Compras PE';
                    } else if (i.sistema_origem_nome && i.sistema_origem_nome !== 'PNCP') {
                        fonteLabel = i.sistema_origem_nome;
                    }
                }

                // Log primeiro item_url para debug (1x por busca)
                if (!fonteLabel && domain) {
                    if (typeof window !== 'undefined') {
                        console.log(`[PORTAL DEBUG] item_url domain="${domain}" item_url="${i.item_url}"`);
                    }
                }

                return { ...i, fonte_dados: fonteLabel || 'PNCP' };
            });

            // A API do PNCP não suporta filtragem por portal de origem.
            // Usamos keyword injection como dica, mas a filtragem real é feita pelas heurísticas
            // de identificação (sistema_origem_id do numero_controle_pncp, URL, texto).
            // Todos os itens são mantidos com seus labels identificados.

            if (ufFilter) items = items.filter((i: any) => (i?.uf || '').toUpperCase() === ufFilter.toUpperCase());
            
            // Filtro client-side de período - filtra pela data de fim de vigência (prazo das propostas)
            // A API do PNCP não retorna data_encerramento_proposta na busca, usamos data_fim_vigencia
            // que corresponde ao prazo final da modalidade.
            if (dataInicialFilter) {
                const minDate = dataInicialFilter;
                items = items.filter((i: any) => {
                    const dateStr = i.data_fim_vigencia || i.data_encerramento_proposta || i.data_publicacao_pncp;
                    if (!dateStr) return true;
                    const datePart = dateStr.split('T')[0];
                    return datePart >= minDate;
                });
            }
            if (dataFinalFilter) {
                const maxDate = dataFinalFilter;
                items = items.filter((i: any) => {
                    const dateStr = i.data_fim_vigencia || i.data_encerramento_proposta || i.data_publicacao_pncp;
                    if (!dateStr) return true;
                    const datePart = dateStr.split('T')[0];
                    return datePart <= maxDate;
                });
            }

            if (orgaoFilter) items = items.filter((i: any) => (i?.orgao_nome?.toLowerCase() || '').includes(orgaoFilter.toLowerCase()) || (i?.orgao_cnpj || '').includes(orgaoFilter));
            if (modalidadeFilter) items = items.filter((i: any) => (i?.modalidade_licitacao_nome?.toLowerCase() || '').includes(modalidadeFilter.toLowerCase()));
            if (municipioFilter) items = items.filter((i: any) => (i?.municipio_nome?.toLowerCase() || '').includes(municipioFilter.toLowerCase()));
            if (poderFilter) items = items.filter((i: any) => (i?.poder_nome?.toLowerCase() || '') === poderFilter.toLowerCase());

            if (statusFilter === 'recebendo_proposta') {
                const now = new Date();
                items = items.filter((i: any) => {
                    if ((i.fonte_dados || '').includes('BLL') && (i.situacao_nome || '').toLowerCase().includes('divulga')) {
                        const start = new Date(i.data_inicio_proposta || i.data_inicio_vigencia);
                        const end = new Date(i.data_encerramento_proposta || i.data_fim_vigencia);
                        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) return start <= now && end >= now;
                    }
                    return true;
                });
            }

            if (valorMinFilter) {
                const min = parseFloat(valorMinFilter.replace(/[^\d.]/g, ''));
                if (!isNaN(min)) items = items.filter((i: any) => {
                    const val = i.valorTotalEstimado || i.valor_global || 0;
                    return val === 0 || val >= min;
                });
            }
            if (valorMaxFilter) {
                const max = parseFloat(valorMaxFilter.replace(/[^\d.]/g, ''));
                if (!isNaN(max)) items = items.filter((i: any) => {
                    const val = i.valorTotalEstimado || i.valor_global || 0;
                    return val === 0 || val <= max;
                });
            }

            if (ordenacaoFilter === '-data_publicacao_pncp') items.sort((a, b) => new Date(b.data_publicacao_pncp || 0).getTime() - new Date(a.data_publicacao_pncp || 0).getTime());
            else if (ordenacaoFilter === 'data_publicacao_pncp') items.sort((a, b) => new Date(a.data_publicacao_pncp || 0).getTime() - new Date(b.data_publicacao_pncp || 0).getTime());

            // Pré-carregar detalhes PNCP em lote (todos os itens, independente de scroll)
            let preloadCount = 0;
            for (const item of items) {
                const parts = item.numero_controle_pncp?.split('-');
                const cacheKey = `${item.orgao_cnpj || parts?.[0]}-${(item as any).ano_compra || (item as any).ano || parts?.[1]}-${(item as any).numero_compra || (item as any).numero_sequencial || parts?.[2]}`;
                if (cacheKey && !cacheKey.includes('undefined') && !pncpDetailCache[cacheKey]?.data && !pncpDetailCache[cacheKey]?.promise) {
                    queuePncpFetch(item).catch(() => {});
                    preloadCount++;
                }
            }
            console.log(`[PNCP PRELOAD] Enfileirados ${preloadCount}/${items.length} itens para detalhamento`);

            setResults(items);
            setTotalResults(total || items.length);
            setPage(currentPage);
            setPageInput(currentPage.toString());
        } catch (err: any) {
            console.error('Fetch error:', err);
            setError('Não foi possível carregar as oportunidades. Tente novamente.');
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    }, [
        keyword, ufFilter, modalidadeFilter, statusFilter, instrumentoFilter,
        esferaFilter, dataInicialFilter, dataFinalFilter, ordenacaoFilter,
        orgaoFilter, municipioFilter, poderFilter, unidadeFilter,
        fonteOrcamentoFilter, conteudoNacionalFilter, margemPreferenciaFilter,
        valorMinFilter, valorMaxFilter, fonteFilter
    ]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOportunidades(1);
        }, 500); 
        return () => clearTimeout(timer);
    }, [
        keyword, ufFilter, modalidadeFilter, statusFilter, instrumentoFilter,
        esferaFilter, dataInicialFilter, dataFinalFilter, ordenacaoFilter,
        orgaoFilter, municipioFilter, poderFilter, unidadeFilter,
        fonteOrcamentoFilter, conteudoNacionalFilter, margemPreferenciaFilter,
        valorMinFilter, valorMaxFilter, fonteFilter
    ]);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        fetchOportunidades(1);
    }, [fetchOportunidades]);

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

    const _hasDateFilter = !!(dataInicialFilter || dataFinalFilter);
    const totalPages = Math.min(Math.ceil(totalResults / (_hasDateFilter ? 500 : 100)), 100);

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-background text-foreground min-h-full">

            <div className="bg-card border-b border-border shrink-0 z-10 shadow-sm">
                <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Target className="h-5 w-5 text-primary" />
                        <h1 className="text-xl font-bold tracking-tight">Explorador PNCP</h1>
                    </div>

                    <form onSubmit={handleSearch} className="flex flex-col gap-3">
                        <div className="flex flex-col lg:flex-row gap-2">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    id="pncp-search-keyword"
                                    name="keyword"
                                    type="text"
                                    placeholder="Buscar objeto, nº do edital ou CNPJ..."
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    className="w-full h-10 bg-background border border-border rounded-md pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                                />
                            </div>
                            
                            <div className="w-full md:w-64 shrink-0">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button type="button" className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 font-bold shadow-sm">
                                            <div className="flex items-center gap-2 truncate">
                                                <Building2 className="h-4 w-4 text-primary shrink-0" />
                                                <span className="truncate">
                                                    {fonteFilter.includes('unificado') 
                                                        ? 'Todos os Portais' 
                                                        : fonteFilter.length === 0 
                                                            ? 'Nenhum Selecionado' 
                                                            : `${fonteFilter.length} Portais Selecionados`}
                                                </span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 opacity-50 rotate-90" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0 bg-card/95 backdrop-blur-xl border-border shadow-2xl z-[150]" align="start">
                                        <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Fontes de Dados</span>
                                            <button 
                                                type="button"
                                                onClick={() => setFonteFilter(['unificado'])}
                                                className="text-[10px] font-bold text-primary hover:underline"
                                            >
                                                Resetar
                                            </button>
                                        </div>
                                        <div className="p-2 space-y-1 max-h-[350px] overflow-auto">
                                            <div 
                                                className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                                onClick={() => setFonteFilter(['unificado'])}
                                            >
                                                <Checkbox checked={fonteFilter.includes('unificado')} id="all-portals" />
                                                <label htmlFor="all-portals" className="text-xs font-bold leading-none cursor-pointer flex-1">
                                                    Todos Portais (Unificado)
                                                </label>
                                            </div>
                                            <div className="h-px bg-border my-2 mx-2" />
                                            {[
                                                { id: 'comprasnet', label: 'Compras.gov.br (Federal)', color: 'text-blue-500' },
                                                { id: 'licitacoese', label: 'Licitações-e (BB)', color: 'text-yellow-600' },
                                                { id: 'pcp', label: 'Portal de Compras Públicas', color: 'text-blue-500' },
                                                { id: 'bll', label: 'BLL Compras', color: 'text-orange-600' },
                                                { id: 'bnc', label: 'Bolsa Nacional de Compras', color: 'text-purple-600' },
                                                { id: 'bbmnet', label: 'BBMNET Licitações', color: 'text-cyan-600' },
                                                { id: 'licitanet', label: 'Licitanet', color: 'text-pink-600' },
                                                { id: 'siga', label: 'SIGA (Paraná/DF)', color: 'text-red-600' },
                                                { id: 'compras-rs', label: 'Compras RS', color: 'text-cyan-600' },
                                                { id: 'ipm', label: 'IPM Sistemas', color: 'text-indigo-600' },
                                                { id: 'betha', label: 'Betha Sistemas', color: 'text-teal-600' },
                                                { id: 'ecustomize', label: 'ECustomize', color: 'text-violet-600' },
                                                { id: 'brconectado', label: 'BR Conectado', color: 'text-sky-600' },
                                                { id: 'governancabrasil', label: 'Governança Brasil', color: 'text-rose-600' },
                                                { id: 'licitamais', label: 'Licita + Brasil', color: 'text-amber-600' },
                                                { id: 'centi', label: 'CENTI', color: 'text-lime-600' },
                                                { id: 'systemdesenv', label: 'System Desenvolvimento', color: 'text-emerald-600' },
                                                { id: 'pncp', label: 'Municipais (via PNCP)', color: 'text-emerald-600' },
                                            ].map((portal) => (
                                                <div 
                                                    key={portal.id}
                                                    className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                                    onClick={() => {
                                                        const isCurrentlyAll = fonteFilter.includes('unificado');
                                                        let newSelection = isCurrentlyAll ? [] : [...fonteFilter];
                                                        
                                                        if (newSelection.includes(portal.id)) {
                                                            newSelection = newSelection.filter(id => id !== portal.id);
                                                        } else {
                                                            newSelection.push(portal.id);
                                                        }
                                                        
                                                        if (newSelection.length === 0) {
                                                            setFonteFilter(['unificado']);
                                                        } else {
                                                            setFonteFilter(newSelection);
                                                        }
                                                    }}
                                                >
                                                    <Checkbox checked={fonteFilter.includes(portal.id) && !fonteFilter.includes('unificado')} />
                                                    <label className={`text-xs font-semibold leading-none cursor-pointer flex-1 ${portal.color}`}>
                                                        {portal.label}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-3 border-t border-border bg-muted/30">
                                            <p className="text-[9px] text-muted-foreground leading-relaxed">
                                                * Selecione múltiplos portais para uma busca simultânea e unificada em todos os diários oficiais.
                                            </p>
                                        </div>
                                    </PopoverContent>
                                </Popover>
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
                                    <Select 
                                        value={instrumentoFilter || 'all'} 
                                        onValueChange={(v) => setInstrumentoFilter(v === 'all' ? '' : v)}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-background border-border text-xs font-bold shadow-sm">
                                            <SelectValue placeholder="Todos Documentos" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="all" className="text-xs font-bold">Todos Documentos</SelectItem>
                                            <SelectItem value="edital" className="text-xs font-bold">Editais / Avisos de Contratação</SelectItem>
                                            <SelectItem value="ata" className="text-xs font-bold">Atas de Registro de Preços</SelectItem>
                                            <SelectItem value="contrato" className="text-xs font-bold">Contratos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Status</label>
                                    <Select 
                                        value={statusFilter || 'all'} 
                                        onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-background border-border text-xs font-bold shadow-sm">
                                            <SelectValue placeholder="Todos os Status" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="all" className="text-xs font-bold">Todos os Status</SelectItem>
                                            <SelectItem value="recebendo_proposta" className="text-xs font-bold">Abertas (Recebendo Propostas)</SelectItem>
                                            <SelectItem value="propostas_encerradas" className="text-xs font-bold">Em Julgamento (Propostas Encerradas)</SelectItem>
                                            <SelectItem value="encerradas" className="text-xs font-bold">Concluída / Encerrada</SelectItem>
                                            <SelectItem value="suspensas" className="text-xs font-bold">Suspensa</SelectItem>
                                            <SelectItem value="canceladas" className="text-xs font-bold">Cancelada</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">UF / Estado</label>
                                    <Select 
                                        value={ufFilter || 'all'} 
                                        onValueChange={(v) => setUfFilter(v === 'all' ? '' : v)}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-background border-border text-xs font-bold shadow-sm">
                                            <SelectValue placeholder="Qualquer UF" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="all" className="text-xs font-bold">Qualquer UF</SelectItem>
                                            {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf} className="text-xs font-bold">{uf}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Esferas</label>
                                    <Select 
                                        value={esferaFilter || 'all'} 
                                        onValueChange={(v) => setEsferaFilter(v === 'all' ? '' : v)}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-background border-border text-xs font-bold shadow-sm">
                                            <SelectValue placeholder="Todas Esferas" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="all" className="text-xs font-bold">Todas Esferas</SelectItem>
                                            <SelectItem value="F" className="text-xs font-bold">Federal</SelectItem>
                                            <SelectItem value="E" className="text-xs font-bold">Estadual</SelectItem>
                                            <SelectItem value="M" className="text-xs font-bold">Municipal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Poderes</label>
                                    <Select 
                                        value={poderFilter || 'all'} 
                                        onValueChange={(v) => setPoderFilter(v === 'all' ? '' : v)}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-background border-border text-xs font-bold shadow-sm">
                                            <SelectValue placeholder="Todos" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="all" className="text-xs font-bold">Todos</SelectItem>
                                            <SelectItem value="Executivo" className="text-xs font-bold">Executivo</SelectItem>
                                            <SelectItem value="Legislativo" className="text-xs font-bold">Legislativo</SelectItem>
                                            <SelectItem value="Judiciário" className="text-xs font-bold">Judiciário</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Organização / Órgão</label>
                                    <input 
                                        id="pncp-filter-orgao"
                                        name="orgao"
                                        type="text" placeholder="Nome ou CNPJ..." value={orgaoFilter} onChange={(e) => setOrgaoFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Modalidade Licit.</label>
                                    <Select 
                                        value={modalidadeFilter || 'all'} 
                                        onValueChange={(v) => setModalidadeFilter(v === 'all' ? '' : v)}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-background border-border text-xs font-bold shadow-sm">
                                            <SelectValue placeholder="Todas" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="all" className="text-xs font-bold">Todas</SelectItem>
                                            <SelectItem value="Pregão" className="text-xs font-bold">Pregão Eletrônico/Presencial</SelectItem>
                                            <SelectItem value="Dispensa" className="text-xs font-bold">Dispensa de Licitação</SelectItem>
                                            <SelectItem value="Concorrência" className="text-xs font-bold">Concorrência</SelectItem>
                                            <SelectItem value="Inexigibilidade" className="text-xs font-bold">Inexigibilidade</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Municípios</label>
                                    <input 
                                        id="pncp-filter-municipio"
                                        name="municipio"
                                        type="text" placeholder="Ex: São Paulo" value={municipioFilter} onChange={(e) => setMunicipioFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Ordenação</label>
                                    <Select 
                                        value={ordenacaoFilter} 
                                        onValueChange={setOrdenacaoFilter}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-background border-border text-xs font-bold shadow-sm">
                                            <SelectValue placeholder="Ordenação" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="-data_publicacao_pncp" className="text-xs font-bold">Mais Recente Primeiro</SelectItem>
                                            <SelectItem value="data_publicacao_pncp" className="text-xs font-bold">Mais Antigo Primeiro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Unid. de Compra</label>
                                    <input 
                                        id="pncp-filter-unidade"
                                        name="unidade"
                                        type="text" placeholder="UASG / Unidade" value={unidadeFilter} onChange={(e) => setUnidadeFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Fonte Orçamentária</label>
                                    <input 
                                        id="pncp-filter-fonte"
                                        name="fonteOrcamento"
                                        type="text" placeholder="Código Fon." value={fonteOrcamentoFilter} onChange={(e) => setFonteOrcamentoFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Cont. Nacional</label>
                                    <Select 
                                        value={conteudoNacionalFilter || 'all'} 
                                        onValueChange={(v) => setConteudoNacionalFilter(v === 'all' ? '' : v)}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-background border-border text-xs font-bold shadow-sm">
                                            <SelectValue placeholder="Qualquer Exigência" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="all" className="text-xs font-bold">Qualquer Exigência</SelectItem>
                                            <SelectItem value="Sim" className="text-xs font-bold">Exige (Sim)</SelectItem>
                                            <SelectItem value="Não" className="text-xs font-bold">Não Exige</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Margens Prefe.</label>
                                    <Select 
                                        value={margemPreferenciaFilter || 'all'} 
                                        onValueChange={(v) => setMargemPreferenciaFilter(v === 'all' ? '' : v)}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-background border-border text-xs font-bold shadow-sm">
                                            <SelectValue placeholder="Todas" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="all" className="text-xs font-bold">Todas</SelectItem>
                                            <SelectItem value="Normal" className="text-xs font-bold">Normal</SelectItem>
                                            <SelectItem value="ME" className="text-xs font-bold">Exclusiva ME/EPP</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Proposta Encerra Após (Data Inicial)</label>
                                    <input 
                                        id="pncp-filter-data-ini"
                                        name="dataInicial"
                                        type="date" value={dataInicialFilter} onChange={(e) => setDataInicialFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Proposta Encerra Até (Data Final)</label>
                                    <input 
                                        id="pncp-filter-data-fim"
                                        name="dataFinal"
                                        type="date" value={dataFinalFilter} onChange={(e) => setDataFinalFilter(e.target.value)} className="w-full h-8 bg-background border border-border rounded px-2 text-xs focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><DollarSign className="h-2.5 w-2.5" /> Valor Mínimo (R$)</label>
                                    <input 
                                        id="pncp-filter-val-min"
                                        name="valorMin"
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
                                        id="pncp-filter-val-max"
                                        name="valorMax"
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
                                        <th className="px-4 py-3 font-medium w-32">Fim Recepção</th>
                                        <th className="px-4 py-3 font-medium w-32 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5">Valor Est.</th>
                                        <th className="px-4 py-3 font-medium">Órgão / Descrição Sintética</th>
                                        <th className="px-4 py-3 font-medium w-32">Modalidade</th>
                                        <th className="px-4 py-3 font-medium w-24">UF</th>
                                        <th className="px-4 py-3 font-medium w-20">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-background">
                                    {results.map((item, index) => {
                                        const exists = isAlreadyInKanban(item);
                                        return (
                                            <tr
                                                key={item.id || index}
                                                onClick={() => setSelectedItem(item)}
                                                className={cn(
                                                    "hover:bg-muted/50 cursor-pointer transition-all group border-l-2",
                                                    exists ? "opacity-40 grayscale-[0.8] border-l-transparent" : "border-l-primary/0 hover:border-l-primary/100"
                                                )}
                                            >
                                            <td className="px-4 py-3.5 align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    <PncpBadgeStatus item={item} />
                                                    {exists && (
                                                        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-primary text-primary-foreground px-1.5 py-0.5 rounded shadow-sm w-fit uppercase tracking-tighter">
                                                            <KanbanSquare className="h-2.5 w-2.5" /> NO KANBAN
                                                        </span>
                                                    )}
                                                </div>
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
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className="text-xs bg-secondary px-2 py-1 rounded text-secondary-foreground">
                                                        {item.modalidade_licitacao_nome}
                                                    </span>
                                                    {(() => {
                                                        return (
                                                            <PortalBadge item={item} />
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 align-top">
                                                <div className="flex items-center gap-1 text-xs">
                                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                                    <span className="font-medium">{item.uf || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 align-top text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        title={exists ? "Já importado" : "Importar para Kanban"}
                                                        disabled={exists}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDirectExportItem(item);
                                                            setIsExportDialogOpen(true);
                                                        }}
                                                        className={cn(
                                                            "h-7 px-2 rounded transition-all flex items-center gap-1 shadow-sm",
                                                            exists 
                                                                ? "bg-muted text-muted-foreground opacity-100 ring-1 ring-border" 
                                                                : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground opacity-0 group-hover:opacity-100"
                                                        )}
                                                    >
                                                        {exists ? <CheckSquare className="h-3.5 w-3.5" /> : <KanbanSquare className="h-3.5 w-3.5" />}
                                                        <span className="text-[10px] font-bold uppercase tracking-wider">{exists ? 'Importado' : 'Importar'}</span>
                                                    </button>
                                                    <div 
                                                        onClick={() => setSelectedItem(item)}
                                                        className="h-7 w-7 rounded bg-secondary text-muted-foreground flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                                                    >
                                                        <ChevronRight className="h-4 w-4" />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden p-4 space-y-4">
                                {results.map((item, index) => {
                                    const exists = isAlreadyInKanban(item);
                                    return (
                                        <div
                                            key={item.id || index}
                                            onClick={() => setSelectedItem(item)}
                                            className={cn(
                                                "bg-card border border-border rounded-xl p-4 shadow-sm space-y-3 active:scale-[0.98] transition-all relative overflow-hidden",
                                                exists ? "opacity-50 grayscale-[0.3]" : ""
                                            )}
                                        >
                                            {exists && (
                                                <div className="absolute top-0 right-0 p-1">
                                                    <div className="bg-primary text-primary-foreground text-[8px] font-black px-1.5 py-0.5 rounded-bl-lg uppercase">Já no Kanban</div>
                                                </div>
                                            )}
                                    <div className="flex justify-between items-start gap-2">
                                        <PncpBadgeStatus item={item} />
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
                                        {(() => {
                                            return (
                                                <PortalBadge item={item} />
                                            );
                                        })()}
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
                                                    {item.data_fim_vigencia ? new Date(item.data_fim_vigencia).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            <button 
                                                title={exists ? "Já importado" : "Importar para Kanban"}
                                                disabled={exists}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDirectExportItem(item);
                                                    setIsExportDialogOpen(true);
                                                }}
                                                className={cn(
                                                    "h-8 px-3 rounded-md transition-all flex items-center gap-1.5 shadow-sm",
                                                    exists
                                                        ? "bg-muted text-muted-foreground ring-1 ring-border"
                                                        : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                                                )}
                                            >
                                                {exists ? <CheckSquare className="h-4 w-4" /> : <KanbanSquare className="h-4 w-4" />}
                                                <span className="text-[10px] font-bold uppercase tracking-wider">{exists ? 'No Kanban' : 'Importar'}</span>
                                            </button>
                                            <ChevronRight className="h-4 w-4 text-primary" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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
                            id="pncp-pagination-page"
                            name="pageNumber"
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
                                    <DialogDescription className="sr-only">
                                        Detalhes da oportunidade: {selectedItem.title}
                                    </DialogDescription>
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
                                                <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border border-border/50">
                                                    <div>
                                                        <span className="block text-[10px] text-muted-foreground uppercase mb-0.5 flex items-center"><DollarSign className="h-3 w-3 mr-0.5" /> Val. Estimado</span>
                                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                            {loadingDetail ? (
                                                                <Loader2 className="h-3 w-3 animate-spin inline-block" />
                                                            ) : (
                                                                formatCurrency(portalData?.valorTotalEstimado || itemDetail?.valorTotalEstimado || selectedItem.valorTotalEstimado || selectedItem.valor_global)
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] text-muted-foreground uppercase mb-0.5">Fim Recepção</span>
                                                        <span className="text-sm font-medium text-destructive">
                                                            {loadingPortal ? (
                                                                <Loader2 className="h-3 w-3 animate-spin inline-block" />
                                                            ) : (
                                                                formatDate(portalData?.dataEncerramentoProposta || selectedItem.data_encerramento_proposta || selectedItem.data_fim_vigencia, true)
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] text-muted-foreground uppercase mb-0.5">Fonte (Sistema Origem)</span>
                                                        <span className="text-sm font-medium">
                                                            {loadingPortal ? (
                                                                <Loader2 className="h-3 w-3 animate-spin inline-block" />
                                                            ) : portalData?.linkSistemaOrigem ? (
                                                                <a href={portalData.linkSistemaOrigem} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 truncate block max-w-[250px]">
                                                                    {new URL(portalData.linkSistemaOrigem).hostname}
                                                                </a>
                                                            ) : portalData?.usuarioNome ? (
                                                                <span className="text-muted-foreground">{portalData.usuarioNome}</span>
                                                            ) : (
                                                                <span className="text-muted-foreground">{selectedItem.fonte_dados || 'PNCP'}</span>
                                                            )}
                                                        </span>
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
                                                                    <div className="flex gap-2 shrink-0">
                                                                        <button 
                                                                            onClick={() => setPreviewData({
                                                                                isOpen: true,
                                                                                url: file.url,
                                                                                name: file.nome || file.titulo || 'Arquivo PNCP',
                                                                                type: 'pdf'
                                                                            })}
                                                                            className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
                                                                        >
                                                                            <FileText className="h-4 w-4" /> VISUALIZAR
                                                                        </button>
                                                                        <a 
                                                                            href={getSafeProxyUrl(normalizeFileUrl(file.url, file.nome))} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer" 
                                                                            className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary hover:scale-110 active:scale-95 transition-all" 
                                                                            title="Abrir em Nova Aba"
                                                                        >
                                                                            <ExternalLink className="h-4.5 w-4.5" />
                                                                        </a>
                                                                        <a 
                                                                            href={file.url} 
                                                                            download 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer" 
                                                                            className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary hover:scale-110 active:scale-95 transition-all" 
                                                                            title="Download Arquivo PNCP"
                                                                        >
                                                                            <Download className="h-4.5 w-4.5" />
                                                                        </a>
                                                                    </div>
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
                                {selectedItem && (
                                    <a
                                        href={getPortalLoginUrl(selectedItem)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-md hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-sm order-4 sm:order-none"
                                    >
                                        <LogIn className="h-4 w-4" /> Login no Portal
                                    </a>
                                )}
                                <a
                                    href={getOfficialLink(selectedItem)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm order-1 sm:order-none"
                                >
                                    Abrir Edital Oficial <ExternalLink className="h-4 w-4" />
                                </a>
                            </div></DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>

            {/* Modal de Preview da Nota de Empenho (Dentro do Sistema) */}
            <AnimatePresence>
                {isExportDialogOpen && (
                    <Dialog open={isExportDialogOpen} onOpenChange={(open) => {
                        setIsExportDialogOpen(open);
                        if (!open) setDirectExportItem(null);
                    }}>
                        <DialogContent className="max-w-md bg-background border border-border rounded-xl shadow-2xl p-6 z-[160]">
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
                                    <Select 
                                        value={exportFolderId} 
                                        onValueChange={(v) => {
                                            setExportFolderId(v);
                                            setExportBoardId('');
                                            setExportListId('');
                                            setExportErrors(prev => ({ ...prev, folder: false }));
                                        }}
                                    >
                                        <SelectTrigger className={`w-full h-9 bg-muted border text-sm transition-all ${exportErrors.folder ? 'border-destructive ring-1 ring-destructive animate-shake' : 'border-border'}`}>
                                            <SelectValue placeholder="Selecione uma pasta..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="none" disabled className="text-xs font-bold">Selecione uma pasta...</SelectItem>
                                            {folders.filter(f => !f.trashed && !f.archived).map(f => (
                                                <SelectItem key={f.id} value={f.id} className="text-xs font-bold">
                                                    {f.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {exportErrors.folder && <p className="text-[10px] text-destructive font-bold uppercase mt-0.5 animate-in fade-in slide-in-from-top-1">Seleção obrigatória</p>}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase text-muted-foreground">2. Escolha o Quadro (Board)</label>
                                    <Select 
                                        value={exportBoardId} 
                                        onValueChange={(v) => {
                                            setExportBoardId(v);
                                            setExportListId('');
                                            setExportErrors(prev => ({ ...prev, board: false }));
                                        }}
                                        disabled={!exportFolderId}
                                    >
                                        <SelectTrigger className={`w-full h-9 bg-muted border text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${exportErrors.board ? 'border-destructive ring-1 ring-destructive animate-shake' : 'border-border'}`}>
                                            <SelectValue placeholder="Selecione o quadro..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="none" disabled className="text-xs font-bold">Selecione o quadro...</SelectItem>
                                            {boards.filter(b => b.folderId === exportFolderId && !b.trashed && !b.archived).map(b => (
                                                <SelectItem key={b.id} value={b.id} className="text-xs font-bold">
                                                    {b.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {exportErrors.board && <p className="text-[10px] text-destructive font-bold uppercase mt-0.5 animate-in fade-in slide-in-from-top-1">Seleção obrigatória</p>}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase text-muted-foreground">3. Escolha a Coluna</label>
                                    <Select 
                                        value={exportListId} 
                                        onValueChange={(v) => {
                                            setExportListId(v);
                                            setExportErrors(prev => ({ ...prev, list: false }));
                                        }}
                                        disabled={!exportBoardId}
                                    >
                                        <SelectTrigger className={`w-full h-9 bg-muted border text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${exportErrors.list ? 'border-destructive ring-1 ring-destructive animate-shake' : 'border-border'}`}>
                                            <SelectValue placeholder="Selecione a coluna (etapa)..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                                            <SelectItem value="none" disabled className="text-xs font-bold">Selecione a coluna (etapa)...</SelectItem>
                                            {lists.filter(l => l.boardId === exportBoardId && !l.trashed && !l.archived).map(l => (
                                                <SelectItem key={l.id} value={l.id} className="text-xs font-bold">
                                                    {l.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {exportErrors.list && <p className="text-[10px] text-destructive font-bold uppercase mt-0.5 animate-in fade-in slide-in-from-top-1">Seleção obrigatória</p>}
                                </div>
                            </div>

                            <div className="mt-8 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setIsExportDialogOpen(false);
                                        setDirectExportItem(null);
                                    }}
                                    className="px-4 py-2 border border-border hover:bg-muted text-sm font-medium rounded-md transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleExportToKanban}
                                    disabled={isExporting}
                                    className="px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isExporting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Exportando...
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
            <FilePreviewModal
                isOpen={previewData.isOpen}
                onClose={() => setPreviewData(prev => ({ ...prev, isOpen: false }))}
                fileUrl={previewData.url}
                fileName={previewData.name}
                fileType={previewData.type}
            />
        </div>
    );
}

