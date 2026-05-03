import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

const PNCP_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
const PNCP_SEARCH_URL = 'https://pncp.gov.br/api/search/';
const CGU_BASE_URL = 'https://api.portaldatransparencia.gov.br/api-de-dados';

const normalizeCnpj = (val: string) => (val || '').replace(/\D/g, '');

const PORTAL_TRANSPARENCIA_TOKEN = process.env.PORTAL_TRANSPARENCIA_TOKEN;

const cguApi = axios.create({
    baseURL: CGU_BASE_URL,
    headers: {
        'chave-api-dados': PORTAL_TRANSPARENCIA_TOKEN || ''
    },
    timeout: 5000
});

/**
 * GET /api/transparency/suggestions
 * Retorna sugestões rápidas de termos de licitação
 */
router.get('/suggestions', (req: Request, res: Response) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    
    const term = q.toString().toUpperCase();
    const suggestions = BIDDING_SUGGESTIONS
        .filter(s => s.toUpperCase().includes(term))
        .sort((a, b) => a.indexOf(term) - b.indexOf(term))
        .slice(0, 8);
        
    res.json(suggestions);
});

const COMMON_BRANDS = [
    'DELL', 'HP', 'LENOVO', 'APPLE', 'SAMSUNG', 'LG', 'ASUS', 'ACER', 'POSITIVO', 'MULTILASER',
    'INTEL', 'AMD', 'EPSON', 'CANON', 'LOGITECH', 'CISCO', 'ARUBA', 'HUAWEI', 'FURUKAWA',
    'MICROSOFT', 'ADOBE', 'ORACLE', 'SAP', 'TOTVS', 'PHILIPS', 'BRASTEMP', 'CONSUL', 'ELECTROLUX',
    'ORTOBRAS', 'OTTOBOCK', 'JAGUARIBE', 'PROLIFE', 'VIVER', 'FREEDOM', 'ESTRELA', 'FISIO', 'CARCI',
    'MERCÚRIO', 'INDIANA', 'INVACARE', 'DRIVE', 'SUNRISE', 'VITAL', 'LUMINA', 'MOBILITY', 'PERMORABIL',
    'CAMIL', 'TIO JOÃO', 'NAMORADO', 'KODILAR', 'NESTLE', 'PILÃO', 'KIMBERLY', 'PIRACANJUBA', 'ITAMBÉ',
    'BIC', 'PILOT', 'FABER-CASTELL', 'STABILO', 'CIS', 'COMPACTOR', 'CROWN', 'PARKER', 'PENTEL', 'MAPED',
    '3M', 'POST-IT', 'CHAMECO', 'CHAMEX', 'REFRIGERANTE', 'COCA-COLA', 'AMBEV', 'ANTARCTICA', 'BRAHMA', 'SKOL'
];

const BIDDING_SUGGESTIONS = [
    'ARROZ', 'AR CONDICIONADO', 'AMBULÂNCIA', 'APARELHO DE RAIO-X', 'ALIMENTOS', 
    'BRINQUEDOS', 'BORRACHA', 'BARCO', 'CADERNO', 'CADEIRA DE RODAS', 'COMPUTADOR', 
    'CANETA', 'CAMISETA', 'CONSULTORIA', 'CONSTRUÇÃO', 'CONSERTO', 'COPO DESCARTÁVEL',
    'DETERGENTE', 'DETETOR DE FUMAÇA', 'DESINFETANTE', 'DRONES', 'EPI', 'ESTANTE',
    'ESCOLA', 'EQUIPAMENTOS DE TI', 'EQUIPAMENTOS MÉDICOS', 'EXTINTOR', 'Fraldas',
    'FERRAMENTAS', 'FOGÃO', 'GASOLINA', 'GÊNEROS ALIMENTÍCIOS', 'GESSO', 'HOSPITAL',
    'HIDRANTE', 'IMPRESSORA', 'INSTALAÇÃO', 'INSETICIDA', 'JARDINAGEM', 'JALECO',
    'KIT ESCOLAR', 'KITS DE DIAGNÓSTICO', 'LÂMPADA', 'LIMPEZA', 'LIVROS', 'LOTE',
    'MANUTENÇÃO', 'MADEREIRA', 'MATERIAL DE CONSTRUÇÃO', 'MATERIAL ESCOLAR', 
    'MEDICAMENTOS', 'MOBILIÁRIO', 'MESA', 'MONITOR', 'NOTEBOOK', 'NUTRIÇÃO', 
    'ÓLEO DIESEL', 'OBRAS', 'ODONTOLÓGICO', 'OXIGÊNIO', 'PNEUS', 'PORTA', 'PAPEL', 
    'PEDREIRO', 'PINTURA', 'PROJETOR', 'QUADRO BRANCO', 'REFORMA', 'RELOJOARIA',
    'REAGENTE', 'REFRIGERADOR', 'REFEIÇÕES', 'SABONETE', 'SONORIZAÇÃO', 'SUPRIMENTOS', 
    'SERVIÇOS DE VIGILÂNCIA', 'TABLET', 'TELA', 'TIJOLO', 'TRANSPORTE ESCOLAR',
    'UNIFORME', 'URNA', 'UTENSÍLIOS', 'VIGILÂNCIA', 'VASCULAR', 'VEÍCULO', 'XEROX', 'ZINCO'
];

const extractBrand = (text: string): string => {
    if (!text) return 'N/A';
    const upperText = text.toUpperCase();

    // 1. CAMADA DE PRIORIDADE: Marcas Conhecidas (Dicionário de Alta Confiança)
    for (const brand of COMMON_BRANDS) {
        const fullWordRegex = new RegExp(`\\b${brand}\\b`, 'i');
        if (fullWordRegex.test(upperText)) {
            return brand;
        }
    }

    // 2. CAMADA DE EXTRAÇÃO (RegEx para Marcas não Tabeladas)
    // IMPORTANT: \b em cada termo do prefixo impede que "MARCAÇÃO" ou "CONTRATAÇÃO" deem match falso.
    const regexList = [
        /\b(?:marca\b|fabricante\b|fabr\b)\s*(?:\/modelo)?\s*[:=\-]?\s*([^;,\n\)\/\-]{2,50})/i,
        /\bmarca\b(?:\s+e\s+modelo)?\s+([^;,\n\)\/\-]{2,50})/i,
        /\bfabricado\s+por\s+([^;,\n\)\/\-]{2,50})/i
    ];

    const junkFragments = ['ICACAO', 'ICAÇÃO', 'ICANTE', 'ICADO', 'ICADA', 'ICADOS', 'ICADAS', 'ÇÃO', 'CÃO', 'ÇÃOS', 'CÕES'];
    const stopWordsPT = [
        'DE', 'PARA', 'COM', 'POR', 'UMA', 'UM', 'DOS', 'DAS', 'NOS', 'NAS', 'PELO', 'PELA', 
        'ESTE', 'ESTA', 'ESSE', 'ESSA', 'AQUELE', 'AQUELA', 'CUJO', 'CUJA', 'S SE', 'O', 'A', 
        'OS', 'AS', 'UM', 'UNS', 'UMA', 'UMAS', 'EM', 'NO', 'NA', 'NOS', 'NAS', 'COMO', 'QUE', 
        'SE', 'OU', 'MAS', 'ENTRE', 'CONTRA', 'SOBRE', 'ANTE', 'APOS', 'ATÉ', 'DESDE', 'PERANTE',
        'QUALQUER', 'TODOS', 'TUDO', 'NADA', 'ALGO', 'OUTRO', 'OUTRA', 'CADA', 'MESMO', 'MESMA'
    ];
    const instructionBlacklist = [
        'REFERENCIA', 'REFERÊNCIA', 'SIMILAR', 'MINIMO', 'MÍNIMO', 'MAXIMO', 'MÁXIMO', 
        'PRAZO', 'VALIDADE', 'EMBALAGEM', 'CAIXA', 'UNIDADE', 'LEGIVEL', 'LEGÍVEL', 
        'INDELEVEL', 'INDELÉVEL', 'MERCADO', 'BRASILEIRO', 'CERTIFICADO', 'DEDOS', 
        'SUJEIRAS', 'LEVES', 'ACORDO', 'DE 01', 'DE 1', 'ITEM', 'LOTE', 'PAGINA', 
        'EDITAL', 'ANEXO', 'PROPRIO', 'PROPRIA', 'NACIONAL', 'VER EDITAL', 'NAO', 
        'N/A', 'DIVERSAS', 'A DEFINIR', 'GENERICA', 'SEM MARCA', 'MARCA', 'QUE O', 
        'DO FABRICANTE', 'DOR', 'ICA', 'DA TV', 'COR', 'AZUL', 'VERDE', 'AMARELA',
        'PRODUTO', 'CAPACIDADE', 'JORNADA'
    ];

    for (const rx of regexList) {
        const match = text.match(rx);
        if (match && match[1]) {
            let found = match[1].trim().toUpperCase();
            
            // Limpeza radical de caracteres de pontuação e parênteses residuais nas pontas
            found = found.replace(/^[(\[.\-_: ]+/, '').replace(/[)\]?.\-_: ]+$/, '').trim(); 
            
            // Corte em termos de controle técnico
            found = found.split(/\b(?:MODELO|REF|LOTE|TIPO|DESC|ESPEC|CATMAT|PARA|COM|NA|NOS|EM|NA COR)\b/i)[0].trim();

            // --- FILTROS DE QUALIDADE ATÔMICA + EXATIDÃO ---
            
            // Filtro 1: Tamanho mínimo e frases curtas
            const words = found.split(/\s+/);
            if (found.length < 2 || words.length > 4) continue;
            
            // Filtro 2: Blacklist de instruções técnicas e termos administrativos
            const hasInstruction = instructionBlacklist.some(term => found.includes(term));
            if (hasInstruction) continue;

            // Filtro 3: Bloqueio de fragmentos internos
            const hasJunkFragment = junkFragments.some(fragment => found.includes(fragment));
            if (hasJunkFragment) continue;
            
            // Filtro 4: Bloqueio de Stopwords isoladas (Purismo da língua)
            // Se o que sobrou for apenas uma palavra comum "DE", ignore.
            if (stopWordsPT.includes(found)) continue;
            
            // Filtro 5: Termos descritivos de material/ação
            if (found.includes('DEVERÁ') || found.includes('DEVERA') || found.includes('CONSULTAR')) continue;
            if (found.startsWith('EM ') || found.includes(' RESISTENTE') || found.includes(' ALTA ')) continue;

            // Se restar algo sólido, retorna
            if (found.length > 1 && found.length < 35) {
                return found;
            }
        }
    }

    return 'N/A';
};

router.get('/licitacoes/:cnpj/:ano/:sequencial/arquivos', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        const url = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos?pagina=1&tamanhoPagina=100`;
        const response = await axios.get(url, { timeout: 5000 });
        const files = response.data || [];
        
        // Marcar arquivos que provavelmente são do vencedor ou de homologação
        const mappedFiles = files.map((f: any) => {
            const name = (f.titulo || f.nome_arquivo || '').toLowerCase();
            const isWinnerDoc = name.includes('proposta') || name.includes('habilitacao') || name.includes('vencedor') || name.includes('homologacao') || name.includes('ata');
            return {
                ...f,
                isWinnerDoc
            };
        });
        
        res.json(mappedFiles);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/transparency/pncp-detail/:cnpj/:ano/:sequencial
 * Proxy para detalhes do PNCP (CORS Safe)
 */
router.get('/pncp-detail/:cnpj/:ano/:sequencial', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        
        // URLs para diferentes endpoints do PNCP
        const detailUrl = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`;
        const itemsCountUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/quantidade`;
        const itemsListUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=100`;

        const commonHeaders = { 'User-Agent': 'Mozilla/5.0' };

        // Executa as chamadas em paralelo (usando settled para não quebrar se um falhar)
        const [detailRes, countRes, itemsRes] = await Promise.allSettled([
            axios.get(detailUrl, { headers: commonHeaders, timeout: 5000 }),
            axios.get(itemsCountUrl, { headers: commonHeaders, timeout: 5000 }),
            axios.get(itemsListUrl, { headers: commonHeaders, timeout: 5000 })
        ]);

        const detailData = detailRes.status === 'fulfilled' ? detailRes.value.data : {};
        const itemCount = countRes.status === 'fulfilled' ? countRes.value.data : 0;
        const itemsResponse = itemsRes.status === 'fulfilled' ? itemsRes.value.data : [];
        
        // Trata o formato de resposta da lista de itens (pode ser array direto ou paginado)
        const items = Array.isArray(itemsResponse) ? itemsResponse : (itemsResponse.data || []);

        // Lógica de metadados baseada nos itens (primeiros 100)
        let hasMeEppBenefit = false;
        let minItemValue = Infinity;
        let maxItemValue = -Infinity;

        if (Array.isArray(items)) {
            items.forEach((item: any) => {
                // Benefícios ME/EPP: 1 (Exclusiva), 2 (Cota), 3 (Subcontratação)
                if ([1, 2, 3].includes(item.tipoBeneficio)) {
                    hasMeEppBenefit = true;
                }
                
                // Pega o valor unitário estimado
                const val = item.valorUnitarioEstimado || (item.quantidade > 0 ? (item.valorTotalEstimado / item.quantidade) : 0) || 0;
                if (val > 0) {
                    if (val < minItemValue) minItemValue = val;
                    if (val > maxItemValue) maxItemValue = val;
                }
            });
        }

        res.json({
            ...detailData,
            itemCount: itemCount || detailData.quantidadeItens || 0,
            hasMeEppBenefit,
            minItemValue: minItemValue === Infinity ? 0 : minItemValue,
            maxItemValue: maxItemValue === -Infinity ? 0 : maxItemValue
        });
    } catch (error: any) {
        if (error.response?.status === 404) return res.status(404).json({ error: 'PNCP detail not found' });
        console.error('PNCP Proxy Detail Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/transparency/pncp-proxy
 * Proxy universal para busca no PNCP (Evita CORS e centraliza User-Agent)
 */
router.get('/pncp-proxy', async (req: Request, res: Response) => {
    try {
        const response = await axios.get('https://pncp.gov.br/api/search/', {
            params: req.query,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 15000,
            paramsSerializer: (params) => {
                const parts: string[] = [];
                Object.entries(params).forEach(([key, val]) => {
                    if (val === undefined || val === null || val === '') return;
                    
                    // Express ou HPP podem manter o nome da chave com [] ou [0]. Remove-los sempre:
                    const cleanKey = key.replace(/\[\d*\]$/, '');

                    if (Array.isArray(val)) {
                        // A API de pesquisa do PNCP exige valores unidos por pipe (status=A|B)
                        const joined = val.join('|');
                        parts.push(`${encodeURIComponent(cleanKey)}=${joined}`);
                    } else {
                        if (typeof val === 'string' && val.includes('|')) {
                            // PNCP requires unencoded pipes for these filters
                            parts.push(`${encodeURIComponent(cleanKey)}=${val}`);
                        } else {
                            parts.push(`${encodeURIComponent(cleanKey)}=${encodeURIComponent(String(val))}`);
                        }
                    }
                });
                return parts.join('&');
            }
        });
        res.json(response.data);
    } catch (error: any) {
        console.error('PNCP Proxy Search Error:', error.message);
        res.status(error.response?.status || 500).json({ 
            error: error.message,
            details: error.response?.data 
        });
    }
});

/**
 * GET /api/transparency/pcp-proxy
 * Proxy Dedicado para o Portal de Compras Públicas (PCP)
 */
router.get('/pcp-proxy', async (req: Request, res: Response) => {
    try {
        // Como o PCP exige PublicKey privada para sua API direta, 
        // a arquitetura mais segura é buscar a malha do PCP dentro do PNCP.
        const newQuery = { ...req.query };
        if (newQuery.q) {
            newQuery.q = `${newQuery.q} [Portal de Compras Públicas]`;
        } else {
            newQuery.q = `[Portal de Compras Públicas]`;
        }

        const response = await axios.get('https://pncp.gov.br/api/search/', {
            params: newQuery,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 15000,
            paramsSerializer: (params) => {
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
            }
        });

        // Filtragem estrita baseada na string "Portal de Compras Públicas" na descrição/título, pois a API do PNCP esconde o sistema_origem_nome na listagem.
        let items = response.data?.items || [];
        items = items.filter((item: any) => 
            (item.description && item.description.toLowerCase().includes('portal de compras públicas')) ||
            (item.title && item.title.toLowerCase().includes('portal de compras públicas')) ||
            (item.item_url && item.item_url.includes('portaldecompraspublicas'))
        ).map((item: any) => ({
            ...item,
            _isPcp: true
        }));

        res.json({
            ...response.data,
            items,
            total: response.data?.total || 0 // Retorna o total da query unificada
        });
    } catch (error: any) {
        console.error('PCP Proxy Search Error:', error.message);
        res.status(error.response?.status || 500).json({ 
            error: error.message,
            details: error.response?.data 
        });
    }
});

/**
 * GET /api/transparency/bll-proxy
 * Proxy Dedicado para a BLL Compras
 */
router.get('/bll-proxy', async (req: Request, res: Response) => {
    try {
        // O proxy agora utiliza o ID oficial da BLL no PNCP (idSistemaOrigem=12)
        const newQuery = { ...req.query };
        newQuery.idSistemaOrigem = '12';

        // Melhoria de Status para BLL no PNCP
        if (newQuery.status) {
            let statuses = Array.isArray(newQuery.status) ? newQuery.status : [newQuery.status];
            if (statuses.includes('recebendo_proposta')) {
                newQuery.status = [...statuses, 'divulgada', 'divulgada_pncp'];
            }
        }

        // BUSCA 1: PNCP Oficial
        const pncpPromise = axios.get('https://pncp.gov.br/api/search/', {
            params: newQuery,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 10000,
            paramsSerializer: (params) => {
                const parts: string[] = [];
                Object.entries(params).forEach(([key, val]) => {
                    if (val === undefined || val === null || val === '') return;
                    const cleanKey = key.replace(/\[\d*\]$/, '');
                    if (Array.isArray(val)) {
                        parts.push(`${encodeURIComponent(cleanKey)}=${val.join('|')}`);
                    } else {
                        parts.push(`${encodeURIComponent(cleanKey)}=${encodeURIComponent(String(val))}`);
                    }
                });
                return parts.join('&');
            }
        });

        // BUSCA 2: BLL Direto (Real-time Fallback)
        // Se houver palavra-chave ou UF, tentamos buscar direto no portal da BLL para cobrir o gap de sincronização.
        const fetchBllDirect = async () => {
            try {
                // BLL Search Params
                const bllParams = new URLSearchParams();
                bllParams.append('Organization', (newQuery.q as string) || '');
                bllParams.append('fkState', Array.isArray(newQuery.ufs) ? newQuery.ufs[0] : (newQuery.ufs as string) || '');
                bllParams.append('fkStatus', '1'); // 1 = Abertas/Recebendo Propostas na BLL
                bllParams.append('X-Requested-With', 'XMLHttpRequest');

                const bllRes = await axios.post('https://bllcompras.com/Process/ProcessSearchPublic', bllParams, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 8000
                });

                // Se retornar HTML (comum em MVC), retornamos vazio por enquanto ou tentamos um parse básico.
                // Se o portal retornar JSON, ele será capturado aqui.
                return bllRes.data?.items || [];
            } catch (e) {
                return [];
            }
        };

        const [pncpRes, bllDirectItems] = await Promise.all([
            pncpPromise.catch(() => ({ data: { items: [], total: 0 } })),
            fetchBllDirect()
        ]);

        let items = pncpRes.data?.items || [];
        
        // Marcar itens vindos do PNCP como BLL
        items = items.map((item: any) => ({
            ...item,
            _isBll: true
        }));

        // TODO: Merge bllDirectItems logic if it's proven to return a stable JSON schema
        // Por hora, o idSistemaOrigem=12 já resolve 99% dos casos no PNCP.

        res.json({
            ...pncpRes.data,
            items,
            total: pncpRes.data?.total || items.length
        });
    } catch (error: any) {
        console.error('BLL Proxy Search Error:', error.message);
        res.status(error.response?.status || 500).json({ 
            error: error.message,
            details: error.response?.data 
        });
    }
});

/**
 * GET /api/transparency/licitacoes
 * Legado para compatibilidade com outras telas (Dashboard, etc)
 */
router.get('/licitacoes', async (req: Request, res: Response) => {
    try {
        const { pagina = '1', termo, dataInicial, dataFinal, status, tam_pagina = '12' } = req.query;
        
        const statusMap: Record<string, string> = {
            'concluido': 'encerradas',
            '3': 'encerradas',
            'em-andamento': 'recebendo_proposta',
            '2': 'recebendo_proposta',
            'suspenso': 'suspensas',
            'cancelado': 'canceladas'
        };

        const sitParam = status && typeof status === 'string' && statusMap[status] ? statusMap[status] : '';
        
        let url = `${PNCP_SEARCH_URL}?q=${encodeURIComponent(termo ? termo.toString() : '*')}&tipos_documento=edital%7Cata%7Ccontrato&ordenacao=-data&pagina=${pagina}&tam_pagina=${tam_pagina}`;
        if (sitParam) url += `&status=${sitParam}`;
        if (dataInicial && typeof dataInicial === 'string') url += `&data_publicacao_inicial=${dataInicial.replace(/-/g, '')}`; 
        if (dataFinal && typeof dataFinal === 'string') url += `&data_publicacao_final=${dataFinal.replace(/-/g, '')}`;

        const response = await axios.get(url, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }, 
            timeout: 15000 
        });
        
        const data: any = response.data;
        let items = data.items || [];

        if (status === 'concluido' || status === '3') {
            items = items.filter((i: any) => i.tem_resultado === true);
        } else if (status === 'em-andamento' || status === '2') {
            items = items.filter((i: any) => String(i.situacao_id) === '2' && !i.tem_resultado);
        }

        const results = items.map((item: any) => ({
            id: item.id || `${item.orgao_cnpj}/${item.ano}/${item.numero_sequencial}`,
            numeroLicitacao: item.title || `${item.numero_sequencial}/${item.ano}`,
            objeto: item.description || 'Sem descrição',
            orgao: item.orgao_nome || 'Órgão Desconhecido',
            dataAbertura: item.data_publicacao_pncp,
            valorLicitacao: item.valor_global || 0,
            situacao: item.tem_resultado === true ? 'Concluída' : (item.situacao_nome || 'Desconhecida'),
            cnpjOrgao: item.orgao_cnpj,
            ano: item.ano,
            sequencial: item.numero_sequencial
        }));

        res.json({
            items: results,
            totalItems: data.total || results.length,
            totalPages: Math.ceil((data.total || results.length) / Number(tam_pagina))
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/transparency/analytics/global-brands
 * Ranking de marcas refinado: Limite de 20 processos e filtro rigoroso por item
 */
router.get('/analytics/global-brands', async (req: Request, res: Response) => {
    try {
        const { termo, dataInicial, dataFinal } = req.query;
        if (!termo) return res.status(400).json({ error: 'Termo de busca é obrigatório' });

        const searchKeyword = termo.toString().toLowerCase();
        const keywords = searchKeyword.split(' ').filter(k => k.length > 2);
        const brandCounts: Record<string, { value: number; totalGasto: number }> = {};
        const allProcesses: any[] = [];
        
        try {
            // API Busca Legada (Amostra 100)
            const searchUrl = `${PNCP_SEARCH_URL}?q=${encodeURIComponent(searchKeyword)}&tipos_documento=edital%7Cata%7Ccontrato&ordenacao=-data&pagina=1&tam_pagina=100&status=encerradas`;
            const searchRes = await axios.get(searchUrl, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*'
                }, 
                timeout: 12000 
            });
            
            if (searchRes.data && searchRes.data.items) {
                // Filtro rigoroso baseado apenas na presença de resultados
                const validOnes = searchRes.data.items.filter((p: any) => p.tem_resultado === true);
                allProcesses.push(...validOnes.slice(0, 50));
            }
        } catch (e: any) { 
            console.error('Error in ranking search (legacy):', e.message); 
        }

        if (allProcesses.length === 0) {
            return res.json({ results: [], version: '2026-03-27-refined-v20' });
        }

        // Processamento paralelo leve (chunks de 10 para suportar 50 processos sem timeout)
        const chunkSize = 10;
        for (let i = 0; i < allProcesses.length; i += chunkSize) {
            const chunk = allProcesses.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (proc: any) => {
                try {
                    const typePath = proc.document_type === 'contrato' ? 'contratos' : 'compras';
                    const itemsUrl = `${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/${typePath}/${proc.ano}/${proc.numero_sequencial}/itens?pagina=1&tamanhoPagina=100`;
                    const itemsRes = await axios.get(itemsUrl, { timeout: 4000 });
                    const items = itemsRes.data || [];

                    for (const item of items) {
                        const desc = (item.descricao || '').toLowerCase();
                        const searchNorm = searchKeyword.toLowerCase();
                        
                        // Lógica de Precisão Estrita: Deve conter a frase exata OU todas as palavras significativas
                        const isMatch = desc.includes(searchNorm) || 
                                        (keywords.length > 0 && keywords.every(k => desc.includes(k.toLowerCase())));
                        
                        if (isMatch) {
                            let brand = 'N/A';
                            
                            // TENTAR PEGAR A MARCA DO VENCEDOR (Dados Reais)
                            if (item.temResultado) {
                                try {
                                    const rRes = await axios.get(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens/${item.numeroItem}/resultados`, { timeout: 3000 });
                                    if (rRes.data && rRes.data.length > 0) {
                                        const winner = rRes.data[0];
                                        if (winner.marcaFornecedor) {
                                            brand = winner.marcaFornecedor.toUpperCase().trim();
                                        }
                                    }
                                } catch (e) {}
                            }

                            // Fallback para marca no item ou regex se PNCP estiver vazio
                            if ((brand === 'N/A' || !brand) && item.marca) {
                                brand = item.marca.toUpperCase().trim();
                            }
                            if (brand === 'N/A') {
                                brand = extractBrand(desc);
                            }

                            if (brand && brand !== 'N/A' && brand.length > 1) {
                                if (!brandCounts[brand]) brandCounts[brand] = { value: 0, totalGasto: 0 };
                                brandCounts[brand].value++;
                                brandCounts[brand].totalGasto += (item.valorUnitarioHomologado || item.valorUnitarioEstimado || item.valorUnitario || 0) * (item.quantidade || 1);
                            }
                        }
                    }
                } catch (e: any) { /* silent fail for item fetch */ }
            }));
        }

        const results = Object.entries(brandCounts)
            .map(([name, data]) => ({ name, ...data }))
            .filter(b => b.name !== 'N/A')
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        res.json({ results, version: '2026-03-27-refined-v21' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Cache for National Thermometer (30 min)
let thermometerCache: any = null;
let lastThermometerFetch = 0;
const CACHE_TTL = 30 * 60 * 1000;

/**
 * GET /api/transparency/national-thermometer
 * Agregação de inteligência nacional (PNCP)
 */
router.get('/national-thermometer', async (req: Request, res: Response) => {
    try {
        const now = Date.now();
        if (thermometerCache && (now - lastThermometerFetch < CACHE_TTL)) {
            return res.json(thermometerCache);
        }

        const todayRaw = new Date();
        const todayStr = todayRaw.toISOString().split('T')[0].replace(/-/g, '');
        
        const last7DaysRaw = new Date(todayRaw.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last7DaysStr = last7DaysRaw.toISOString().split('T')[0].replace(/-/g, '');

        // 1. Hoje e Total (Paralelo controlado)
        let todayCount = 0;
        let totalActive = 121000;
        try {
            const [todayRes, totalActiveRes] = await Promise.all([
                axios.get(`${PNCP_SEARCH_URL}?pagina=1&tam_pagina=1&data_publicacao_inicial=${todayStr}&tipos_documento=edital`, { timeout: 6000 }),
                axios.get(`${PNCP_SEARCH_URL}?pagina=1&tam_pagina=1&status=recebendo_proposta&tipos_documento=edital`, { timeout: 6000 })
            ]);
            todayCount = todayRes.data.total || 0;
            totalActive = totalActiveRes.data.total || 121000;
        } catch (e) {
            console.warn('Today/Total Fetch Fail (using fallback)');
        }

        // 2. Média Semanal
        let weeklyAvg = 1200;
        try {
            const last7Res = await axios.get(`${PNCP_SEARCH_URL}?pagina=1&tam_pagina=1&data_publicacao_inicial=${last7DaysStr}&tipos_documento=edital`, { timeout: 6000 });
            weeklyAvg = Math.round((last7Res.data.total || 8000) / 7);
        } catch (e) {
            console.warn('Weekly Fetch Fail (using fallback)');
        }

        // 3. Nichos de Mercado (SEQUENCIAL para não estressar o servidor/conexão)
        const niches = [
            { id: 'ti', name: 'Tecnologia / TI', keywords: 'informatica|computador|software|TI' },
            { id: 'saude', name: 'Saúde / Médicos', keywords: 'saude|medico|hospitalar' },
            { id: 'obras', name: 'Obras / Eng', keywords: 'obras|construção|reforma' },
            { id: 'alimentos', name: 'Alimentos', keywords: 'alimentos|merenda' },
            { id: 'servicos', name: 'Serviços Gerais', keywords: 'limpeza|segurança|vigilancia' }
        ];

        const nicheDistribution: any[] = [];
        for (const n of niches) {
            try {
                // Request individual com timeout curto
                const r = await axios.get(`${PNCP_SEARCH_URL}?pagina=1&tam_pagina=1&q=${encodeURIComponent(n.keywords)}&tipos_documento=edital&status=recebendo_proposta`, { timeout: 4000 });
                nicheDistribution.push({ name: n.name, value: r.data.total || 0 });
            } catch {
                nicheDistribution.push({ name: n.name, value: 0 });
            }
        }

        const result = {
            success: true,
            todayCount,
            totalActive,
            weeklyAvg,
            nicheDistribution,
            lastUpdate: new Date().toISOString()
        };

        thermometerCache = result;
        lastThermometerFetch = now;
        res.json(result);
    } catch (error: any) {
        console.error('National Thermometer Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/transparency/analytics/global-brands-stream
 * EventSource Endpoint: Varre o portal até achar 30 marcas OU bater 5 páginas e envia updates parciais de progresso.
 */
router.get('/analytics/global-brands-stream', async (req: Request, res: Response) => {
    try {
        const { keyword } = req.query;
        if (!keyword) {
            res.status(400).json({ error: 'Termo de busca é obrigatório' });
            return;
        }

        const searchKeyword = keyword.toString().trim();
        // Remove stopwords curtas e pega as palavras significativas
        const keywords = searchKeyword.split(' ').filter(k => k.length > 3 && !['para', 'com', 'dos', 'das'].includes(k.toLowerCase()));

        // SSE Configuração Estrita Anti-Buffering
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform'); // no-transform BYPASSES THE COMPRESSION MODULE!
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Bypass Nginx buffering
        res.setHeader('X-Accel-Buffering', 'no'); // Bypass Nginx buffering
        res.flushHeaders(); // Envia os headers imediatamente

        // Enviar PADDING inicial de 2KB (Comentários SSE) para forçar o buffer do Proxy a "quebrar"
        // Alguns navegadores/proxies esperam um volume mínimo para começar a transmitir
        res.write(": " + " ".repeat(2048) + "\n\n");

        let brandCounts: Record<string, { value: number; totalGasto: number }> = {};
        let totalMarcasDiversas = 0;
        let procsAnalisados = 0;
        let pagina = 1;
        const META_MARCAS = 30;
        const LIMITE_PAGINAS = 5;
        let buscouMais = true;

        const sendEvent = (eventName: string, data: any) => {
            res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
            if (typeof (res as any).flush === 'function') {
                (res as any).flush();
            }
        };

        sendEvent('progress', { message: 'Iniciando varredura profunda no PNP...', found: 0, checked: 0 });

        while (totalMarcasDiversas < META_MARCAS && pagina <= LIMITE_PAGINAS && buscouMais) {
            sendEvent('progress', { message: `Recuperando página ${pagina} do arquivo (lotes de 100)...`, found: totalMarcasDiversas, checked: procsAnalisados });
            
            const searchUrl = `${PNCP_SEARCH_URL}?q=${encodeURIComponent(searchKeyword)}&tipos_documento=edital%7Cata%7Ccontrato&ordenacao=-data&pagina=${pagina}&tam_pagina=100&status=encerradas`;
            let searchRes;
            try {
                searchRes = await axios.get(searchUrl, { 
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/plain, */*'
                    }, 
                    timeout: 12000 
                });
            } catch (e) {
                buscouMais = false;
                break;
            }

            if (!searchRes.data || !searchRes.data.items || searchRes.data.items.length === 0) {
                buscouMais = false; // Acabaram as licitações
                break;
            }

            // Exclusivo: O governo não tem marcas em licitações "Divulgadas" q n tiveram resultado final
            const validOnes = searchRes.data.items.filter((p: any) => p.tem_resultado === true);
            if (validOnes.length === 0) {
                pagina++;
                continue;
            }

            // Chunk ocioso em paralelo para não tomar timeout
            const chunkSize = 10;
            for (let i = 0; i < validOnes.length; i += chunkSize) {
                if (totalMarcasDiversas >= META_MARCAS) break; // Bateu a meta
                
                const currentChunk = i + 1;
                const totalChunk = Math.min(i + chunkSize, validOnes.length);
                sendEvent('progress', { message: `Filtrando ganhadores ${currentChunk} a ${totalChunk} (Página ${pagina})...`, found: totalMarcasDiversas, checked: procsAnalisados });

                const chunk = validOnes.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (proc: any) => {
                    try {
                        const typePath = proc.document_type === 'contrato' ? 'contratos' : 'compras';
                        const itemsUrl = `${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/${typePath}/${proc.ano}/${proc.numero_sequencial}/itens?pagina=1&tamanhoPagina=100`;
                        const itemsRes = await axios.get(itemsUrl, { timeout: 4000 });
                        const items = itemsRes.data || [];

                        for (const item of items) {
                            const desc = (item.descricao || '').toLowerCase();
                            const searchNorm = searchKeyword.toLowerCase();
                            
                            // Lógica de Precisão Estrita (Streaming): Deve conter a frase exata OU todas as palavras significativas
                            const isMatch = desc.includes(searchNorm) || 
                                            (keywords.length > 0 && keywords.every(k => desc.includes(k.toLowerCase())));
                            
                            if (isMatch) {
                                let brand = 'N/A';
                                if (item.temResultado) {
                                    try {
                                        const rRes = await axios.get(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens/${item.numeroItem}/resultados`, { timeout: 3000 });
                                        if (rRes.data && rRes.data.length > 0) {
                                            const winner = rRes.data[0];
                                            if (winner.marcaFornecedor) brand = winner.marcaFornecedor.toUpperCase().trim();
                                        }
                                    } catch (e) {}
                                }

                                if ((brand === 'N/A' || !brand) && item.marca) brand = item.marca.toUpperCase().trim();
                                if (brand === 'N/A') brand = extractBrand(desc);

                                if (brand && brand !== 'N/A' && brand.length > 1 && brand !== 'SEM MARCA' && brand !== 'NAO SE APLICA' && brand !== 'NACIONAL') {
                                    if (!brandCounts[brand]) {
                                        brandCounts[brand] = { value: 0, totalGasto: 0 };
                                        totalMarcasDiversas++; // Contabilizou nova marca distinta
                                    }
                                    brandCounts[brand].value++;
                                    brandCounts[brand].totalGasto += (item.valorUnitarioHomologado || item.valorUnitarioEstimado || item.valorUnitario || 0) * (item.quantidade || 1);
                                }
                            }
                        }
                    } catch (e) { /* silent fail */ }
                    procsAnalisados++; // Aumenta visual counter
                }));
            }
            pagina++;
        }

        const rankingFinal = Object.entries(brandCounts)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.value - a.value)
            .slice(0, META_MARCAS); // Garante corte pros 30 maiores do mundo real

        sendEvent('complete', { results: rankingFinal, totalChecked: procsAnalisados });
        res.end();
    } catch (error: any) {
        console.error("Erro Fluxo SSE Marcas:", error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();
        res.end();
    }
});

/**
 * GET /api/transparency/licitacoes/:cnpj/:ano/:sequencial/itens-completos
 * Retorna todos os itens COM seus respectivos resultados (vencedores) e tenta localizar Nota de Empenho (CGU)
 */
router.get('/licitacoes/:cnpj/:ano/:sequencial/itens-completos', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        const { termo } = req.query; // Para filtragem do empenho específico
        const urlItems = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=500`;
        const itemsRes = await axios.get(urlItems, { timeout: 5000 });
        const items = itemsRes.data || [];

        // Buscar empenhos relacionados na CGU antecipadamente (opcional, mas ajuda a vincular)
        let empenhosCGU: any[] = [];
        try {
            const empenhosRes = await cguApi.get('/empenhos', {
                params: {
                    cnpjOrgao: cnpj,
                    pagina: 1
                    // A API da CGU não filtra por licitação diretamente, mas podemos filtrar por órgão e período
                }
            });
            empenhosCGU = empenhosRes.data || [];
        } catch (e) {}

        const detailedItems = await Promise.all(items.map(async (item: any) => {
            let vencedor = null;
            let marca = extractBrand(item.descricao || item.description);
            let empenhoUrl = null;
            
            try {
                const urlResult = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/${item.numeroItem}/resultados`;
                const rr = await axios.get(urlResult, { timeout: 5000 });
                if (rr.data && rr.data.length > 0) {
                    const winner = rr.data[0];
                    
                    // Tentar localizar nota de empenho na CGU para este vencedor
                    let empenhoDados = null;
                    if (winner.niFornecedor) {
                        const targetNi = normalizeCnpj(winner.niFornecedor);
                        // Tenta encontrar um empenho no órgão com o mesmo CNPJ do vencedor
                        const matchEmpenho = empenhosCGU.find((e: any) => 
                            normalizeCnpj(e.credor?.cnpjcpf) === targetNi || 
                            e.credor?.nome?.includes(winner.nomeRazaoSocialFornecedor?.substring(0, 8))
                        );
                        
                        // URL de Busca Estável (Evita 404 de IDs internos e atalhos quebrados)
                        // Vai direto para o mecanismo de busca geral usando o CNPJ do vendedor (Rota 200 OK)
                        empenhoUrl = `https://portaldatransparencia.gov.br/busca?termo=${targetNi}`;

                        if (matchEmpenho) {
                            empenhoDados = {
                                numero: matchEmpenho.numeroEmpenho,
                                data: matchEmpenho.dataEmissao,
                                valor: matchEmpenho.valorOriginal || winner.valorTotalHomologado
                            };
                            // Se temos o ID exato, podemos também oferecer o link direto como alternativa interna, 
                            // mas o link de busca pública é mais resiliente para o usuário final.
                        }
                    }

                    vencedor = { 
                        nome: winner.nomeRazaoSocialFornecedor, 
                        cnpj: winner.niFornecedor, 
                        valor: winner.valorTotalHomologado,
                        marcaFornecedor: winner.marcaFornecedor,
                        modeloFornecedor: winner.modeloFornecedor,
                        empenhoUrl,
                        empenhoDados
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

        res.json(detailedItems);
    } catch (error: any) {
        console.error("Erro ao buscar itens completos:", error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/transparency/licitacoes/:cnpj/:ano/:sequencial/cgu
 * Busca informações no Portal da Transparência da CGU usando o Token
 */
router.get('/licitacoes/:cnpj/:ano/:sequencial/cgu', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        const response = await cguApi.get('/licitacoes', {
            params: {
                cnpjOrgao: cnpj,
                pagina: 1
            }
        });

        const match = (response.data || []).find((l: any) => 
            l.numeroLicitacao?.includes(sequencial) && l.dataAbertura?.includes(ano)
        );

        res.json({
            cguData: match || null,
            allResults: response.data || [],
            info: "Dados extraídos via API Portal da Transparência (CGU)"
        });
    } catch (error: any) {
        console.error("Erro CGU API:", error.message);
        res.json({ error: "Portal da Transparência temporariamente indisponível ou Token inválido.", cguData: null });
    }
});

// Removidos duplicados de licitacoes e arquivos (Mantida apenas a versão robusta no topo)

/**
 * GET /api/transparency/analytics/global-brands
 */
// Removido analytics duplicado (Mantida a versão refinada v21)

router.get('/licitacoes/:cnpj/:ano/:sequencial/itens-base', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        const response = await axios.get(`${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens`);
        res.json(response.data || []);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
