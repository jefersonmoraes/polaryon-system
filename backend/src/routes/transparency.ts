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

    return 'N/A';
};

/**
 * GET /api/transparency/licitacoes
 */
router.get('/licitacoes', async (req: Request, res: Response) => {
    try {
        const { pagina = '1', termo, dataInicial, dataFinal, situacao = 'concluido', tam_pagina = '20' } = req.query;
        
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
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' }
        });

        const data: any = response.data;
        const totalElements = data.total_items || data.total_elements || data.totalItems || data.totalElements || 0;

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

        const searchUrl = `${PNCP_SEARCH_URL}/?q=${termo}&tipos_documento=edital%7Cata%7Ccontrato&ordenacao=-data&pagina=1&tam_pagina=30&situacao=concluido`;
        const searchRes = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const processes = searchRes.data.items || [];

        const brandCounts: Record<string, { value: number; totalGasto: number }> = {};
        const keywords = termo.toString().toLowerCase().split(' ');

        await Promise.all(processes.slice(0, 10).map(async (proc: any) => {
            try {
                const itemsRes = await axios.get(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens`);
                const items = itemsRes.data;
                (items || []).forEach((item: any) => {
                    const desc = (item.description || '').toLowerCase();
                    if (keywords.every(k => desc.includes(k))) {
                        const brand = extractBrand(item.description);
                        if (brand !== 'N/A') {
                            if (!brandCounts[brand]) brandCounts[brand] = { value: 0, totalGasto: 0 };
                            brandCounts[brand].value++;
                            brandCounts[brand].totalGasto += (item.valorUnitarioEstimado || 0) * (item.quantidade || 0);
                        }
                    }
                });
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
        const { termo } = req.query;
        const keywords = termo ? termo.toString().toLowerCase().split(' ') : [];

        const response = await axios.get(`${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens`);
        const items: any = response.data;

        const filteredItems = (items || []).filter((item: any) => {
            if (keywords.length === 0) return true;
            const desc = (item.description || '').toLowerCase();
            return keywords.every(k => desc.includes(k));
        });

        const detailedItems = await Promise.all(filteredItems.map(async (item: any) => {
            let vencedor = null;
            let marca = extractBrand(item.description);

            if (item.temResultado) {
                try {
                    const resUrl = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/${item.numeroItem}/resultados`;
                    const resResponse = await axios.get(resUrl);
                    const resultados: any = resResponse.data;
                    if (resultados && resultados.length > 0) {
                        const winner = resultados[0];
                        vencedor = {
                            nome: winner.nomeRazaoSocialFornecedor,
                            cnpj: winner.niFornecedor,
                            valor: winner.valorTotalHomologado
                        };
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
        const response = await axios.get(url);
        const data: any = response.data;
        
        const files = (data || []).map((file: any) => ({
            id: file.id,
            nome: file.titulo,
            url: `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${file.sequencial}/documento`,
            originalUrl: `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${file.sequencial}`,
            dataPublicacao: file.dataPublicacao,
            documentoVencedor: file.titulo.toLowerCase().includes('proposta') || 
                               file.titulo.toLowerCase().includes('vencedor') || 
                               file.titulo.toLowerCase().includes('habilitacao') ||
                               file.titulo.toLowerCase().includes('lance')
        }));

        res.json(files);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
