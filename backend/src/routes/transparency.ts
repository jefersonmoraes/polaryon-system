import express, { Request, Response } from 'express';

const router = express.Router();

const PNCP_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
const PNCP_SEARCH_URL = 'https://pncp.gov.br/api/search';

const COMMON_BRANDS = [
    'DELL', 'HP', 'LENOVO', 'APPLE', 'SAMSUNG', 'LG', 'ASUS', 'ACER', 'POSITIVO', 'MULTILASER',
    'INTEL', 'AMD', 'EPSON', 'CANON', 'LOGITECH', 'CISCO', 'ARUBA', 'HUAWEI', 'FURUKAWA',
    'MICROSOFT', 'ADOBE', 'ORACLE', 'SAP', 'TOTVS', 'PHILIPS', 'BRASTEMP', 'CONSUL', 'ELECTROLUX'
];

const extractBrand = (text: string): string => {
    if (!text) return 'Não informada';
    
    // Pattern 1: Look for "Marca: BRAND"
    const brandMatch = text.match(/Marca:\s*([^;,\n\)]+)/i);
    if (brandMatch && brandMatch[1].trim().length > 1) {
        return brandMatch[1].trim().toUpperCase();
    }

    // Pattern 2: Look for common brand names in the text
    const upperText = text.toUpperCase();
    for (const brand of COMMON_BRANDS) {
        if (upperText.includes(brand)) return brand;
    }

    return 'Não informada';
};

/**
 * GET /api/transparency/licitacoes
 */
router.get('/licitacoes', async (req: Request, res: Response) => {
    try {
        const { pagina = '1', termo, dataInicial, dataFinal, situacao, tam_pagina = '20' } = req.query;
        
        let url = `${PNCP_SEARCH_URL}/?q=${termo || ''}&pagina=${pagina}&tipos_documento=edital%7Cata%7Ccontrato%7Cpcaorgao&ordenacao=-data&tam_pagina=${tam_pagina}`;
        
        if (dataInicial) {
            // Ensure YYYY-MM-DD
            const d = dataInicial.toString().includes('/') ? dataInicial.toString().split('/').reverse().join('-') : dataInicial.toString();
            url += `&dataPublicacaoDataInicial=${d}`;
        }
        if (dataFinal) {
            const d = dataFinal.toString().includes('/') ? dataFinal.toString().split('/').reverse().join('-') : dataFinal.toString();
            url += `&dataPublicacaoDataFinal=${d}`;
        }
        if (situacao && situacao !== 'todas') {
            url += `&situacao=${situacao}`;
        }

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error(`Erro na busca PNCP: ${response.status}`);
        const data: any = await response.json();

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
            totalItems: data.total_items || results.length,
            totalPages: Math.ceil((data.total_items || results.length) / Number(tam_pagina))
        });
    } catch (error: any) {
        console.error('[Transparency Search Error]:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/transparency/analytics/global-brands
 */
router.get('/analytics/global-brands', async (req: Request, res: Response) => {
    try {
        const { termo } = req.query;
        if (!termo) return res.status(400).json({ error: 'Termo de busca é obrigatório' });

        const searchUrl = `${PNCP_SEARCH_URL}/?q=${termo}&tipos_documento=edital%7Cata%7Ccontrato&ordenacao=-data&pagina=1&tam_pagina=30`;
        const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const searchData: any = await searchRes.json();
        const processes = searchData.items || [];

        const brandCounts: Record<string, { value: number; totalGasto: number }> = {};

        await Promise.all(processes.slice(0, 10).map(async (proc: any) => {
            try {
                const itemsRes = await fetch(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens`);
                if (itemsRes.ok) {
                    const items = await itemsRes.json();
                    items.forEach((item: any) => {
                        const brand = extractBrand(item.descricao);
                        if (brand !== 'Não informada') {
                            if (!brandCounts[brand]) brandCounts[brand] = { value: 0, totalGasto: 0 };
                            brandCounts[brand].value++;
                            brandCounts[brand].totalGasto += (item.valorUnitarioEstimado || 0) * (item.quantidade || 0);
                        }
                    });
                }
            } catch (err) {}
        }));

        const results = Object.entries(brandCounts)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 15);

        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/transparency/licitacoes/:cnpj/:ano/:sequencial/itens
 */
router.get('/licitacoes/:cnpj/:ano/:sequencial/itens', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        const response = await fetch(`${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens`);
        if (!response.ok) throw new Error(`Erro itens: ${response.status}`);
        const items: any = await response.json();

        const detailedItems = await Promise.all(items.map(async (item: any) => {
            let vencedor = null;
            let marca = extractBrand(item.descricao);

            if (item.temResultado) {
                try {
                    const resUrl = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/${item.numeroItem}/resultados`;
                    const resResponse = await fetch(resUrl);
                    if (resResponse.ok) {
                        const resultados: any = await resResponse.json();
                        if (resultados && resultados.length > 0) {
                            const winner = resultados[0];
                            vencedor = {
                                nome: winner.nomeRazaoSocialFornecedor,
                                cnpj: winner.niFornecedor,
                                valor: winner.valorTotalHomologado
                            };
                        }
                    }
                } catch (e) {}
            }

            return {
                numero: item.numeroItem,
                descricao: item.descricao,
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

/**
 * GET /api/transparency/licitacoes/:cnpj/:ano/:sequencial/arquivos
 */
router.get('/licitacoes/:cnpj/:ano/:sequencial/arquivos', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        const url = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos?pagina=1&tamanhoPagina=50`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro arquivos: ${response.status}`);
        const data: any = await response.json();
        
        const files = (data || []).map((file: any) => ({
            id: file.id,
            nome: file.titulo,
            url: `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${file.sequencial}/documento`,
            dataPublicacao: file.dataPublicacao,
            documentoVencedor: file.titulo.toLowerCase().includes('proposta') || file.titulo.toLowerCase().includes('vencedor') || file.titulo.toLowerCase().includes('habilitacao')
        }));

        res.json(files);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
