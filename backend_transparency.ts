import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

const PNCP_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
const PNCP_SEARCH_URL = 'https://pncp.gov.br/api/search/';
const CGU_BASE_URL = 'https://api.portaldatransparencia.gov.br/api-de-dados';

const PNCP_CACHE = new Map<string, { ts: number, data: any }>();

const normalizeCnpj = (val: string) => (val || '').replace(/\D/g, '');

const PORTAL_TRANSPARENCIA_TOKEN = process.env.PORTAL_TRANSPARENCIA_TOKEN;

const cguApi = axios.create({
    baseURL: CGU_BASE_URL,
    headers: {
        'chave-api-dados': PORTAL_TRANSPARENCIA_TOKEN || ''
    },
    timeout: 10000
});

/**
 * GET /api/transparency/suggestions
 * Retorna sugest├Áes r├ípidas de termos de licita├º├úo
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
    'MERC├ÜRIO', 'INDIANA', 'INVACARE', 'DRIVE', 'SUNRISE', 'VITAL', 'LUMINA', 'MOBILITY', 'PERMORABIL',
    'CAMIL', 'TIO JO├âO', 'NAMORADO', 'KODILAR', 'NESTLE', 'PIL├âO', 'KIMBERLY', 'PIRACANJUBA', 'ITAMB├ë',
    'BIC', 'PILOT', 'FABER-CASTELL', 'STABILO', 'CIS', 'COMPACTOR', 'CROWN', 'PARKER', 'PENTEL', 'MAPED',
    '3M', 'POST-IT', 'CHAMECO', 'CHAMEX', 'REFRIGERANTE', 'COCA-COLA', 'AMBEV', 'ANTARCTICA', 'BRAHMA', 'SKOL'
];

const BIDDING_SUGGESTIONS = [
    'ARROZ', 'AR CONDICIONADO', 'AMBUL├éNCIA', 'APARELHO DE RAIO-X', 'ALIMENTOS', 
    'BRINQUEDOS', 'BORRACHA', 'BARCO', 'CADERNO', 'CADEIRA DE RODAS', 'COMPUTADOR', 
    'CANETA', 'CAMISETA', 'CONSULTORIA', 'CONSTRU├ç├âO', 'CONSERTO', 'COPO DESCART├üVEL',
    'DETERGENTE', 'DETETOR DE FUMA├çA', 'DESINFETANTE', 'DRONES', 'EPI', 'ESTANTE',
    'ESCOLA', 'EQUIPAMENTOS DE TI', 'EQUIPAMENTOS M├ëDICOS', 'EXTINTOR', 'Fraldas',
    'FERRAMENTAS', 'FOG├âO', 'GASOLINA', 'G├èNEROS ALIMENT├ìCIOS', 'GESSO', 'HOSPITAL',
    'HIDRANTE', 'IMPRESSORA', 'INSTALA├ç├âO', 'INSETICIDA', 'JARDINAGEM', 'JALECO',
    'KIT ESCOLAR', 'KITS DE DIAGN├ôSTICO', 'L├éMPADA', 'LIMPEZA', 'LIVROS', 'LOTE',
    'MANUTEN├ç├âO', 'MADEREIRA', 'MATERIAL DE CONSTRU├ç├âO', 'MATERIAL ESCOLAR', 
    'MEDICAMENTOS', 'MOBILI├üRIO', 'MESA', 'MONITOR', 'NOTEBOOK', 'NUTRI├ç├âO', 
    '├ôLEO DIESEL', 'OBRAS', 'ODONTOL├ôGICO', 'OXIG├èNIO', 'PNEUS', 'PORTA', 'PAPEL', 
    'PEDREIRO', 'PINTURA', 'PROJETOR', 'QUADRO BRANCO', 'REFORMA', 'RELOJOARIA',
    'REAGENTE', 'REFRIGERADOR', 'REFEI├ç├òES', 'SABONETE', 'SONORIZA├ç├âO', 'SUPRIMENTOS', 
    'SERVI├çOS DE VIGIL├éNCIA', 'TABLET', 'TELA', 'TIJOLO', 'TRANSPORTE ESCOLAR',
    'UNIFORME', 'URNA', 'UTENS├ìLIOS', 'VIGIL├éNCIA', 'VASCULAR', 'VE├ìCULO', 'XEROX', 'ZINCO'
];

const extractBrand = (text: string): string => {
    if (!text) return 'N/A';
    const upperText = text.toUpperCase();

    // 1. CAMADA DE PRIORIDADE: Marcas Conhecidas (Dicion├írio de Alta Confian├ºa)
    for (const brand of COMMON_BRANDS) {
        const fullWordRegex = new RegExp(`\\b${brand}\\b`, 'i');
        if (fullWordRegex.test(upperText)) {
            return brand;
        }
    }

    // 2. CAMADA DE EXTRA├ç├âO (RegEx para Marcas n├úo Tabeladas)
    // IMPORTANT: \b em cada termo do prefixo impede que "MARCA├ç├âO" ou "CONTRATA├ç├âO" deem match falso.
    const regexList = [
        /\b(?:marca\b|fabricante\b|fabr\b)\s*(?:\/modelo)?\s*[:=\-]?\s*([^;,\n\)\/\-]{2,50})/i,
        /\bmarca\b(?:\s+e\s+modelo)?\s+([^;,\n\)\/\-]{2,50})/i,
        /\bfabricado\s+por\s+([^;,\n\)\/\-]{2,50})/i
    ];

    const junkFragments = ['ICACAO', 'ICA├ç├âO', 'ICANTE', 'ICADO', 'ICADA', 'ICADOS', 'ICADAS', '├ç├âO', 'C├âO', '├ç├âOS', 'C├òES'];
    const stopWordsPT = [
        'DE', 'PARA', 'COM', 'POR', 'UMA', 'UM', 'DOS', 'DAS', 'NOS', 'NAS', 'PELO', 'PELA', 
        'ESTE', 'ESTA', 'ESSE', 'ESSA', 'AQUELE', 'AQUELA', 'CUJO', 'CUJA', 'S SE', 'O', 'A', 
        'OS', 'AS', 'UM', 'UNS', 'UMA', 'UMAS', 'EM', 'NO', 'NA', 'NOS', 'NAS', 'COMO', 'QUE', 
        'SE', 'OU', 'MAS', 'ENTRE', 'CONTRA', 'SOBRE', 'ANTE', 'APOS', 'AT├ë', 'DESDE', 'PERANTE',
        'QUALQUER', 'TODOS', 'TUDO', 'NADA', 'ALGO', 'OUTRO', 'OUTRA', 'CADA', 'MESMO', 'MESMA'
    ];
    const instructionBlacklist = [
        'REFERENCIA', 'REFER├èNCIA', 'SIMILAR', 'MINIMO', 'M├ìNIMO', 'MAXIMO', 'M├üXIMO', 
        'PRAZO', 'VALIDADE', 'EMBALAGEM', 'CAIXA', 'UNIDADE', 'LEGIVEL', 'LEG├ìVEL', 
        'INDELEVEL', 'INDEL├ëVEL', 'MERCADO', 'BRASILEIRO', 'CERTIFICADO', 'DEDOS', 
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
            
            // Limpeza radical de caracteres de pontua├º├úo e par├¬nteses residuais nas pontas
            found = found.replace(/^[(\[.\-_: ]+/, '').replace(/[)\]?.\-_: ]+$/, '').trim(); 
            
            // Corte em termos de controle t├®cnico
            found = found.split(/\b(?:MODELO|REF|LOTE|TIPO|DESC|ESPEC|CATMAT|PARA|COM|NA|NOS|EM|NA COR)\b/i)[0].trim();

            // --- FILTROS DE QUALIDADE AT├öMICA + EXATID├âO ---
            
            // Filtro 1: Tamanho m├¡nimo e frases curtas
            const words = found.split(/\s+/);
            if (found.length < 2 || words.length > 4) continue;
            
            // Filtro 2: Blacklist de instru├º├Áes t├®cnicas e termos administrativos
            const hasInstruction = instructionBlacklist.some(term => found.includes(term));
            if (hasInstruction) continue;

            // Filtro 3: Bloqueio de fragmentos internos
            const hasJunkFragment = junkFragments.some(fragment => found.includes(fragment));
            if (hasJunkFragment) continue;
            
            // Filtro 4: Bloqueio de Stopwords isoladas (Purismo da l├¡ngua)
            // Se o que sobrou for apenas uma palavra comum "DE", ignore.
            if (stopWordsPT.includes(found)) continue;
            
            // Filtro 5: Termos descritivos de material/a├º├úo
            if (found.includes('DEVER├ü') || found.includes('DEVERA') || found.includes('CONSULTAR')) continue;
            if (found.startsWith('EM ') || found.includes(' RESISTENTE') || found.includes(' ALTA ')) continue;

            // Se restar algo s├│lido, retorna
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
        
        // Marcar arquivos que provavelmente s├úo do vencedor ou de homologa├º├úo
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
        const cacheKey = `pncp-detail-${cnpj}-${ano}-${sequencial}`;
        
        // Cache de 10 minutos para detalhes de licitação
        if (PNCP_CACHE.has(cacheKey) && (Date.now() - PNCP_CACHE.get(cacheKey)!.ts < 600000)) {
            return res.json(PNCP_CACHE.get(cacheKey)!.data);
        }
        
        // URLs para diferentes endpoints do PNCP
        const detailUrl = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`;
        const itemsCountUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/quantidade`;
        const itemsListUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=100`;

        const commonHeaders = { 'User-Agent': 'Mozilla/5.0' };

        // Executa as chamadas em paralelo (usando settled para não quebrar se um falhar)
        const [detailRes, countRes, itemsRes] = await Promise.allSettled([
            axios.get(detailUrl, { headers: commonHeaders, timeout: 10000 }),
            axios.get(itemsCountUrl, { headers: commonHeaders, timeout: 5000 }),
            axios.get(itemsListUrl, { headers: commonHeaders, timeout: 8000 })
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

        const finalData = {
            ...detailData,
            itemCount: itemCount || detailData.quantidadeItens || 0,
            hasMeEppBenefit,
            minItemValue: minItemValue === Infinity ? 0 : minItemValue,
            maxItemValue: maxItemValue === -Infinity ? 0 : maxItemValue
        };

        PNCP_CACHE.set(cacheKey, { ts: Date.now(), data: finalData });
        res.json(finalData);
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
            objeto: item.description || 'Sem descri├º├úo',
            orgao: item.orgao_nome || '├ôrg├úo Desconhecido',
            dataAbertura: item.data_publicacao_pncp,
            valorLicitacao: item.valor_global || 0,
            situacao: item.tem_resultado === true ? 'Conclu├¡da' : (item.situacao_nome || 'Desconhecida'),
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
        if (!termo) return res.status(400).json({ error: 'Termo de busca ├® obrigat├│rio' });

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
                // Filtro rigoroso baseado apenas na presen├ºa de resultados
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
                        
                        // L├│gica de Precis├úo Estrita: Deve conter a frase exata OU todas as palavras significativas
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

/**
 * GET /api/transparency/analytics/global-brands-stream
 * EventSource Endpoint: Varre o portal at├® achar 30 marcas OU bater 5 p├íginas e envia updates parciais de progresso.
 */
router.get('/analytics/global-brands-stream', async (req: Request, res: Response) => {
    try {
        const { keyword } = req.query;
        if (!keyword) {
            res.status(400).json({ error: 'Termo de busca ├® obrigat├│rio' });
            return;
        }

        const searchKeyword = keyword.toString().trim();
        // Remove stopwords curtas e pega as palavras significativas
        const keywords = searchKeyword.split(' ').filter(k => k.length > 3 && !['para', 'com', 'dos', 'das'].includes(k.toLowerCase()));

        // SSE Configura├º├úo Estrita Anti-Buffering
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Bypass Nginx buffering
        res.flushHeaders(); // Envia os headers imediatamente

        // Enviar PADDING inicial de 2KB (Coment├írios SSE) para for├ºar o buffer do Proxy a "quebrar"
        // Alguns navegadores/proxies esperam um volume m├¡nimo para come├ºar a transmitir
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
        };

        sendEvent('progress', { message: 'Iniciando varredura profunda no PNP...', found: 0, checked: 0 });

        while (totalMarcasDiversas < META_MARCAS && pagina <= LIMITE_PAGINAS && buscouMais) {
            sendEvent('progress', { message: `Recuperando p├ígina ${pagina} do arquivo (lotes de 100)...`, found: totalMarcasDiversas, checked: procsAnalisados });
            
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
                buscouMais = false; // Acabaram as licita├º├Áes
                break;
            }

            // Exclusivo: O governo n├úo tem marcas em licita├º├Áes "Divulgadas" q n tiveram resultado final
            const validOnes = searchRes.data.items.filter((p: any) => p.tem_resultado === true);
            if (validOnes.length === 0) {
                pagina++;
                continue;
            }

            // Chunk ocioso em paralelo para n├úo tomar timeout
            const chunkSize = 10;
            for (let i = 0; i < validOnes.length; i += chunkSize) {
                if (totalMarcasDiversas >= META_MARCAS) break; // Bateu a meta
                
                const currentChunk = i + 1;
                const totalChunk = Math.min(i + chunkSize, validOnes.length);
                sendEvent('progress', { message: `Filtrando ganhadores ${currentChunk} a ${totalChunk} (P├ígina ${pagina})...`, found: totalMarcasDiversas, checked: procsAnalisados });

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
                            
                            // L├│gica de Precis├úo Estrita (Streaming): Deve conter a frase exata OU todas as palavras significativas
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
        const { termo } = req.query; // Para filtragem do empenho espec├¡fico
        const urlItems = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=500`;
        const itemsRes = await axios.get(urlItems, { timeout: 10000 });
        const items = itemsRes.data || [];

        // Buscar empenhos relacionados na CGU antecipadamente (opcional, mas ajuda a vincular)
        let empenhosCGU: any[] = [];
        try {
            const empenhosRes = await cguApi.get('/empenhos', {
                params: {
                    cnpjOrgao: cnpj,
                    pagina: 1
                    // A API da CGU n├úo filtra por licita├º├úo diretamente, mas podemos filtrar por ├│rg├úo e per├¡odo
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
                        // Tenta encontrar um empenho no ├│rg├úo com o mesmo CNPJ do vencedor
                        const matchEmpenho = empenhosCGU.find((e: any) => 
                            normalizeCnpj(e.credor?.cnpjcpf) === targetNi || 
                            e.credor?.nome?.includes(winner.nomeRazaoSocialFornecedor?.substring(0, 8))
                        );
                        
                        // URL de Busca Est├ível (Evita 404 de IDs internos e atalhos quebrados)
                        // Vai direto para o mecanismo de busca geral usando o CNPJ do vendedor (Rota 200 OK)
                        empenhoUrl = `https://portaldatransparencia.gov.br/busca?termo=${targetNi}`;

                        if (matchEmpenho) {
                            empenhoDados = {
                                numero: matchEmpenho.numeroEmpenho,
                                data: matchEmpenho.dataEmissao,
                                valor: matchEmpenho.valorOriginal || winner.valorTotalHomologado
                            };
                            // Se temos o ID exato, podemos tamb├®m oferecer o link direto como alternativa interna, 
                            // mas o link de busca p├║blica ├® mais resiliente para o usu├írio final.
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
 * Busca informa├º├Áes no Portal da Transpar├¬ncia da CGU usando o Token
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
            info: "Dados extra├¡dos via API Portal da Transpar├¬ncia (CGU)"
        });
    } catch (error: any) {
        console.error("Erro CGU API:", error.message);
        res.json({ error: "Portal da Transpar├¬ncia temporariamente indispon├¡vel ou Token inv├ílido.", cguData: null });
    }
});

// Removidos duplicados de licitacoes e arquivos (Mantida apenas a vers├úo robusta no topo)

/**
 * GET /api/transparency/analytics/global-brands
 */
// Removido analytics duplicado (Mantida a vers├úo refinada v21)

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
