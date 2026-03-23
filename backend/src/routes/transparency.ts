import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

const PNCP_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
const PNCP_SEARCH_URL = 'https://pncp.gov.br/api/search';

const COMMON_BRANDS = [
    'DELL', 'HP', 'LENOVO', 'APPLE', 'SAMSUNG', 'LG', 'ASUS', 'ACER', 'POSITIVO', 'MULTILASER',
    'INTEL', 'AMD', 'EPSON', 'CANON', 'LOGITECH', 'CISCO', 'ARUBA', 'HUAWEI', 'FURUKAWA',
    'MICROSOFT', 'ADOBE', 'ORACLE', 'SAP', 'TOTVS', 'PHILIPS', 'BRASTEMP', 'CONSUL', 'ELECTROLUX',
    'ORTOBRAS', 'OTTOBOCK', 'JAGUARIBE', 'PROLIFE', 'VIVER', 'FREEDOM', 'ESTRELA', 'FISIO', 'CARCI',
    'MERCÚRIO', 'INDIANA', 'INVACARE', 'DRIVE', 'SUNRISE'
];

const extractBrand = (text: string): string => {
    if (!text) return 'N/A';
    
    // Pattern 1: Look for "Marca: BRAND" (Specific word boundaries)
    const brandMatch = text.match(/\bMarca:\s*([^;,\n\)]+)/i);
    if (brandMatch && brandMatch[1].trim().length > 1) {
        return brandMatch[1].trim().toUpperCase();
    }

    // Pattern 2: Look for common brand names as WHOLE WORDS
    const upperText = text.toUpperCase();
    for (const brand of COMMON_BRANDS) {
        // Use regex for whole word match to avoid substrings
        const regex = new RegExp(`\\b${brand}\\b`, 'i');
        if (regex.test(upperText)) return brand;
    }

    return 'N/A';
};

/**
 * GET /api/transparency/licitacoes
 */
router.get('/licitacoes', async (req: Request, res: Response) => {
    try {
        const { pagina = '1', termo, dataInicial, dataFinal, situacao = 'concluido', tam_pagina = '50' } = req.query;
        
        let url = `${PNCP_SEARCH_URL}/?q=${termo || ''}&pagina=${pagina}&tipos_documento=edital%7Cata%7Ccontrato%7Cpcaorgao&ordenacao=-data&tam_pagina=${tam_pagina}`;
        
        if (dataInicial) {
            const d = dataInicial.toString().includes('/') ? dataInicial.toString().split('/').reverse().join('-') : dataInicial.toString();
            url += `&dataPublicacaoDataInicial=${d}`;
        }
        if (dataFinal) {
            const d = dataFinal.toString().includes('/') ? dataFinal.toString().split('/').reverse().join('-') : dataFinal.toString();
            url += `&dataPublicacaoDataFinal=${d}`;
        }
        
        const sit = (situacao === 'todas' || !situacao) ? '' : situacao;
        if (sit) url += `&situacao=${sit}`;

        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const data: any = response.data;
        const totalElements = data.total_items || data.total_elements || 0;

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
        
        // Vamos buscar até 5 páginas de 100 processos cada (Total de 500 processos de amostra)
        // Mais que isso pode dar timeout ou atingir limites do PNCP
        const fetchDepth = 3; // 300 processos já é muito para análise síncrona, mas vamos tentar
        const pages = Array.from({ length: fetchDepth }, (_, i) => i + 1);

        const allProcessesPromises = pages.map(async (page) => {
            let searchUrl = `${PNCP_SEARCH_URL}/?q=${termo}&tipos_documento=edital%7Cata%7Ccontrato&ordenacao=-data&pagina=${page}&tam_pagina=100&situacao=concluido`;
            if (dataInicial) searchUrl += `&dataPublicacaoDataInicial=${dataInicial}`;
            if (dataFinal) searchUrl += `&dataPublicacaoDataFinal=${dataFinal}`;
            
            try {
                const searchRes = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                return searchRes.data.items || [];
            } catch (e) {
                return [];
            }
        });

        const processLists = await Promise.all(allProcessesPromises);
        const processes = processLists.flat();

        // Processar em lotes para não sobrecarregar
        const batchSize = 10;
        for (let i = 0; i < processes.length; i += batchSize) {
            const batch = processes.slice(i, i + batchSize);
            await Promise.all(batch.map(async (proc: any) => {
                try {
                    const itemsRes = await axios.get(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens`);
                    const items = itemsRes.data || [];
                    
                    for (const item of items) {
                        const desc = (item.descricao || item.description || '').toLowerCase();
                        
                        // REGRA DE OURO: O item deve conter as palavras-chave principais
                        const matchesKeyword = keywords.every(k => desc.includes(k));
                        
                        if (matchesKeyword) {
                            let brand = extractBrand(item.descricao || item.description);
                            
                            if (brand === 'N/A' && item.temResultado) {
                                try {
                                    const resUrl = `${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens/${item.numeroItem}/resultados`;
                                    const resResponse = await axios.get(resUrl);
                                    const resultados = resResponse.data || [];
                                    if (resultados.length > 0 && resultados[0].marcaFornecedor) {
                                        brand = resultados[0].marcaFornecedor.toUpperCase();
                                    }
                                } catch (e) {}
                            }

                            if (brand !== 'N/A' && brand.length > 1) {
                                // Evitar marcas genéricas de informática se a busca for por mobiliário
                                // Se a busca não tem "informática/computador" e a marca for de TI, daria falso positivo?
                                // Mas confiamos no filtro de keywords acima.
                                if (!brandCounts[brand]) brandCounts[brand] = { value: 0, totalGasto: 0 };
                                brandCounts[brand].value++;
                                brandCounts[brand].totalGasto += (item.valorUnitarioEstimado || 0) * (item.quantidade || 0);
                            }
                        }
                    }
                } catch (err) {}
            }));
            
            // Se já temos dados suficientes (ex: 300 itens processados), podemos parar para poupar recursos
            if (Object.keys(brandCounts).length > 200) break;
        }

        const results = Object.entries(brandCounts)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 30);

        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * RESTO DAS ROTAS... (MANTIDAS)
 */
router.get('/licitacoes/:cnpj/:ano/:sequencial/itens', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        const { termo } = req.query;
        const keywords = (termo || '').toString().toLowerCase().split(' ').filter(k => k.length > 2);

        const response = await axios.get(`${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens`);
        const items: any = response.data || [];

        const filteredItems = items.filter((item: any) => {
            if (keywords.length === 0) return true;
            const desc = (item.descricao || item.description || '').toLowerCase();
            return keywords.every(k => desc.includes(k));
        });

        const detailedItems = await Promise.all(filteredItems.map(async (item: any) => {
            let vencedor = null;
            let marca = extractBrand(item.descricao || item.description);
            try {
                const resUrl = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/${item.numeroItem}/resultados`;
                const resResponse = await axios.get(resUrl);
                const resultados = resResponse.data || [];
                if (resultados.length > 0) {
                    const winner = resultados[0];
                    vencedor = {
                        nome: winner.nomeRazaoSocialFornecedor,
                        cnpj: winner.niFornecedor,
                        valor: winner.valorTotalHomologado
                    };
                    if (marca === 'N/A' && winner.marcaFornecedor) {
                        marca = winner.marcaFornecedor.toUpperCase();
                    }
                }
            } catch (e) {}
            return {
                numero: item.numeroItem,
                descricao: item.descricao || item.description,
                quantidade: item.quantidade,
                valorUnitario: item.valorUnitarioEstimado,
                vencedor,
                marca: marca
            };
        }));
        res.json(detailedItems);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/licitacoes/:cnpj/:ano/:sequencial/arquivos', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        const url = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos?pagina=1&tamanhoPagina=100`;
        const response = await axios.get(url);
        const data: any = response.data || [];
        const files = data.map((file: any) => ({
            id: file.id,
            nome: file.titulo,
            url: `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${file.sequencial}/documento`,
            originalUrl: `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${file.sequencial}`,
            dataPublicacao: file.dataPublicacao,
            documentoVencedor: /proposta|venc|ganhador|habilitac|lance|homolog|adj|vitoria|termo/i.test(file.titulo)
        }));
        res.json(files);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
