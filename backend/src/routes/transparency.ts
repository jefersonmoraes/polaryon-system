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
            'em-andamento': 'em-andamento'
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
        const items = data.items || [];

        const results = items.map((item: any) => ({
            id: item.id || `${item.orgao_cnpj}/${item.ano}/${item.numero_sequencial}`,
            numeroLicitacao: item.title || `${item.numero_sequencial}/${item.ano}`,
            objeto: item.description || 'Sem descrição',
            orgao: item.orgao_nome || 'Órgão Desconhecido',
            dataAbertura: item.data_publicacao_pncp,
            valorLicitacao: item.valor_global || 0,
            situacao: item.situacao_nome || 'Desconhecida',
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
                // A API legada usa p.tem_resultado
                const validOnes = searchRes.data.items.filter((p: any) => 
                    p.tem_resultado === true || p.valor_global > 0
                );
                allProcesses.push(...validOnes.slice(0, 20));
            }
        } catch (e: any) { 
            console.error('Error in ranking search (legacy):', e.message); 
        }

        if (allProcesses.length === 0) {
            return res.json({ results: [], version: '2026-03-27-refined-v20' });
        }

        // Processamento paralelo leve (chunks de 3)
        const chunkSize = 3;
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
                        
                        // URL de Busca Estável (Evita 404 de IDs internos)
                        // A URL de lista com parâmetros é 100% garantida de carregar os resultados certos
                        empenhoUrl = `https://portaldatransparencia.gov.br/despesas/empenhos/lista?faf=true&aberto=false&cnpjOrgao=${cnpj}&cpfCnpj=${targetNi}`;

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
