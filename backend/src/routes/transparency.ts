import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

const PNCP_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
const PNCP_SEARCH_URL = 'https://pncp.gov.br/api/search/';
const CGU_BASE_URL = 'https://api.portaldatransparencia.gov.br/api-v1';

const normalizeCnpj = (val: string) => (val || '').replace(/\D/g, '');

const PORTAL_TRANSPARENCIA_TOKEN = process.env.PORTAL_TRANSPARENCIA_TOKEN;

const cguApi = axios.create({
    baseURL: CGU_BASE_URL,
    headers: {
        'chave-api-dados': PORTAL_TRANSPARENCIA_TOKEN || ''
    },
    timeout: 10000
});

const COMMON_BRANDS = [
    'DELL', 'HP', 'LENOVO', 'APPLE', 'SAMSUNG', 'LG', 'ASUS', 'ACER', 'POSITIVO', 'MULTILASER',
    'INTEL', 'AMD', 'EPSON', 'CANON', 'LOGITECH', 'CISCO', 'ARUBA', 'HUAWEI', 'FURUKAWA',
    'MICROSOFT', 'ADOBE', 'ORACLE', 'SAP', 'TOTVS', 'PHILIPS', 'BRASTEMP', 'CONSUL', 'ELECTROLUX',
    'ORTOBRAS', 'OTTOBOCK', 'JAGUARIBE', 'PROLIFE', 'VIVER', 'FREEDOM', 'ESTRELA', 'FISIO', 'CARCI',
    'MERCÚRIO', 'INDIANA', 'INVACARE', 'DRIVE', 'SUNRISE', 'VITAL', 'LUMINA', 'MOBILITY', 'PERMORABIL'
];

const extractBrand = (text: string): string => {
    if (!text) return 'N/A';
    const brandMatch = text.match(/\bMarca\s*:\s*([^;,\n\)\/\-]+)/i);
    if (brandMatch && brandMatch[1].trim().length > 1) {
        const found = brandMatch[1].trim().toUpperCase();
        if (found.length < 30) return found;
    }
    const upperText = text.toUpperCase();
    for (const brand of COMMON_BRANDS) {
        const regex = new RegExp(`\\b${brand}\\b`, 'i');
        if (regex.test(upperText)) return brand;
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
 * GET /api/transparency/licitacoes
 */
router.get('/licitacoes', async (req: Request, res: Response) => {
    try {
        const { pagina = '1', termo, dataInicial, dataFinal, status, tam_pagina = '12' } = req.query;
        
        // Mapeamento correto para a API de Busca (Legacy mas funcional)
        const statusMap: Record<string, string> = {
            'concluido': 'encerradas',
            '3': 'encerradas',
            'em-andamento': 'em-andamento',
            '2': 'em-andamento'
        };

        const sitParam = status && typeof status === 'string' && statusMap[status] ? statusMap[status] : '';
        
        // URL Corrigida: tam_pagina, sem duplicidade de / e q obrigatório
        let url = `${PNCP_SEARCH_URL}?q=${encodeURIComponent(termo ? termo.toString() : '*')}&tipos_documento=edital&ordenacao=-data&pagina=${pagina}&tam_pagina=${tam_pagina}`;
        if (sitParam) url += `&status=${sitParam}`;
        if (dataInicial) url += `&dataPublicacaoDataInicial=${dataInicial}`;
        if (dataFinal) url += `&dataPublicacaoDataFinal=${dataFinal}`;

        const response = await axios.get(url, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }, 
            timeout: 15000 
        });
        
        const data: any = response.data;
        let items = data.items || [];

        // REQUISITO: Filtro de Segurança In-Memory para garantir precisão de status
        // A API de busca legada do PNCP muitas vezes trava o status em "1" (Divulgada) mesmo após a conclusão.
        // O indicador 100% confiável de conclusão é a presença real de um ganhador (`tem_resultado === true`).
        if (status === 'concluido' || status === '3') {
            items = items.filter((i: any) => i.tem_resultado === true);
        } else if (status === 'em-andamento' || status === '2') {
            items = items.filter((i: any) => String(i.situacao_id) === '2' && !i.tem_resultado);
        }

        const results = items.map((item: any) => {
            const isTrullyConcluded = item.tem_resultado === true;
            return {
                id: item.id || `${item.orgao_cnpj}/${item.ano}/${item.numero_sequencial}`,
                numeroLicitacao: item.title || `${item.numero_sequencial}/${item.ano}`,
                objeto: item.description || 'Sem descrição',
                orgao: item.orgao_nome || 'Órgão Desconhecido',
                dataAbertura: item.data_publicacao_pncp,
                valorLicitacao: item.valor_global || 0,
                situacao: isTrullyConcluded ? 'Concluída' : (item.situacao_nome || 'Desconhecida'),
                cnpjOrgao: item.orgao_cnpj,
                ano: item.ano,
                sequencial: item.numero_sequencial,
                isConcluidaCacheBug: isTrullyConcluded && (!item.valor_global || Number(item.valor_global) === 0)
            };
        });

        res.json({
            items: results,
            totalItems: data.total || results.length,
            totalPages: Math.ceil((data.total || results.length) / Number(tam_pagina))
        });
    } catch (error: any) {
        console.error('ERROR PNCP SEARCH LEGACY:', error.message);
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
            const searchUrl = `${PNCP_SEARCH_URL}?q=${encodeURIComponent(searchKeyword)}&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=100&status=encerradas`;
            const searchRes = await axios.get(searchUrl, { 
                headers: { 'User-Agent': 'Mozilla/5.0' }, 
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
                        
                        // Normalização simples para busca (remover acentos se necessário, mas includes básico já ajuda)
                        const searchNorm = searchKeyword.toLowerCase();
                        const isMatch = desc.includes(searchNorm) || keywords.every(k => desc.includes(k.toLowerCase()));
                        
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

        // SSE Configuração
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // Envia os headers imediatamente

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
            sendEvent('progress', { message: `Recuperando página ${pagina} do arquivo (lotes de 100)...`, found: totalMarcasDiversas, checked: procsAnalisados });
            
            const searchUrl = `${PNCP_SEARCH_URL}?q=${encodeURIComponent(searchKeyword)}&tipos_documento=edital&ordenacao=-data&pagina=${pagina}&tam_pagina=100&status=encerradas`;
            let searchRes;
            try {
                searchRes = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000 });
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
                            
                            // A API PNCP já filtrou o *processo*. Para o *item*, aceitamos se bater alguma keyword ou se a busca for muito longa (confiando no processo)
                            const isMatch = keywords.length === 0 || 
                                            desc.includes(searchNorm) || 
                                            keywords.some(k => desc.includes(k.toLowerCase())) ||
                                            keywords.length > 4; // Se usou uma frase gigante, assume que os itens do processo são relevantes
                            
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
        const { termo } = req.query; // Para filtragem do empenho específico
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
                        // Vai direto para o mecanismo de busca de despesas usando o CNPJ do vendedor
                        empenhoUrl = `https://portaldatransparencia.gov.br/busca/despesas?termo=${targetNi}`;

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

router.get('/licitacoes/:cnpj/:ano/:sequencial/arquivos', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        const url = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos?pagina=1&tamanhoPagina=100`;
        const response = await axios.get(url, { timeout: 5000 });
        const files = response.data || [];
        
        const mappedFiles = files.map((f: any) => {
            const name = (f.titulo || f.nome_arquivo || '').toLowerCase();
            const isWinnerDoc = /proposta|venc|ganhador|habilitac|lance|homolog|adj|vitoria|termo|ata/i.test(name);
            return {
                ...f,
                id: f.id || f.sequencial,
                nome: f.titulo || f.nome_arquivo,
                url: `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${f.sequencial}/documento`,
                originalUrl: `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${f.sequencial}`,
                dataPublicacao: f.dataPublicacao,
                isWinnerDoc
            };
        });
        
        res.json(mappedFiles);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/transparency/licitacoes
 */
router.get('/licitacoes', async (req: Request, res: Response) => {
    try {
        const { pagina = '1', termo, dataInicial, dataFinal, status = 'encerradas', tam_pagina = '10' } = req.query;
        let url = `${PNCP_SEARCH_URL}/?q=${termo || ''}&pagina=${pagina}&tipos_documento=edital%7Cata%7Ccontrato&ordenacao=-data&tam_pagina=${tam_pagina}`;
        if (dataInicial) url += `&dataPublicacaoDataInicial=${dataInicial}`;
        if (dataFinal) url += `&dataPublicacaoDataFinal=${dataFinal}`;
        
        if (status && status !== 'todas') {
            url += `&status=${status}`;
        }

        const response = await axios.get(url, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }, 
            timeout: 15000 
        });
        const data: any = response.data;
        
        const totalElements = Math.min(data.total || data.total_items || data.total_elements || 0, 50);

        const results = (data.items || []).map((item: any) => ({
            id: `${item.orgao_cnpj}/${item.ano}/${item.numero_sequencial}`,
            numeroLicitacao: item.title || `${item.numero_sequencial}/${item.ano}`,
            objeto: item.description || 'Sem descrição',
            orgao: item.orgao_nome,
            dataAbertura: item.data_publicacao_pncp,
            valorLicitacao: item.valor_global || 0,
            situacao: item.situacao_nome,
            cnpjOrgao: item.orgao_cnpj,
            ano: item.ano,
            sequencial: item.numero_sequencial
        }));

        res.json({
            items: results,
            totalItems: Number(totalElements),
            totalPages: Math.ceil(Number(totalElements) / Number(tam_pagina))
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/transparency/analytics/global-brands
 */
router.get('/analytics/global-brands', async (req: Request, res: Response) => {
    try {
        const { termo, dataInicial, dataFinal } = req.query;
        if (!termo) return res.status(400).json({ error: 'Termo de busca é obrigatório' });

        const keywords = termo.toString().toLowerCase().split(' ').filter(k => k.length > 2);
        const brandCounts: Record<string, { value: number; totalGasto: number }> = {};
        const allProcesses: any[] = [];
        
        try {
            let searchUrl = `${PNCP_SEARCH_URL}/?q=${termo}&tipos_documento=edital%7Cata%7Ccontrato&ordenacao=-data&pagina=1&tam_pagina=50&status=encerradas`;
            if (dataInicial) searchUrl += `&dataPublicacaoDataInicial=${dataInicial}`;
            if (dataFinal) searchUrl += `&dataPublicacaoDataFinal=${dataFinal}`;
            
            const searchRes = await axios.get(searchUrl, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }, 
                timeout: 8000 
            });
            
            if (searchRes.data && searchRes.data.items) {
                const concluded = searchRes.data.items.filter((p: any) => p.tem_resultado === true);
                allProcesses.push(...concluded);
            }
        } catch (e: any) { console.error('Error in ranking search:', e.message); }

        if (allProcesses.length === 0) {
            return res.json({ results: [], version: '2026-03-24-v5-concluded-only' });
        }

        const chunkSize = 2;
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
                        const isMatch = keywords.some(k => desc.includes(k));
                        
                        if (isMatch) {
                            let brand = extractBrand(desc);
                            
                            if (item.temResultado) {
                                try {
                                    const rRes = await axios.get(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens/${item.numeroItem}/resultados`, { timeout: 2000 });
                                    if (rRes.data && rRes.data.length > 0) {
                                        const winner = rRes.data[0];
                                        if (winner.marcaFornecedor) {
                                            brand = winner.marcaFornecedor.toUpperCase().trim();
                                        }
                                    }
                                } catch (e) {}
                            }

                            if ((brand === 'N/A' || !brand) && item.marca) {
                                brand = item.marca.toUpperCase().trim();
                            }

                            if (brand && brand !== 'N/A' && brand.length > 1) {
                                if (!brandCounts[brand]) brandCounts[brand] = { value: 0, totalGasto: 0 };
                                brandCounts[brand].value++;
                                brandCounts[brand].totalGasto += (item.valorUnitarioHomologado || item.valorUnitarioEstimado || item.valorUnitario || 0) * (item.quantidade || 1);
                            }
                        }
                    }
                } catch (e: any) { console.error(`Error processing ranking items:`, e.message); }
            }));
        }

        const results = Object.entries(brandCounts)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        res.json({ results, version: '2026-03-24-v5-winner-data' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

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
