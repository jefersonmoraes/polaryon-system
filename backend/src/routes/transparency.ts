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
    const brandMatch = text.match(/Marca:\s*([^;,\n\)]+)/i);
    if (brandMatch && brandMatch[1].trim().length > 1) {
        return brandMatch[1].trim().toUpperCase();
    }
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
        const { pagina = '1', termo, dataInicial, dataFinal, situacao = 'concluido', tam_pagina = '50' } = req.query;
        let url = `${PNCP_SEARCH_URL}/?q=${termo || ''}&pagina=${pagina}&tipos_documento=edital%7Cata%7Ccontrato%7Cpcaorgao&ordenacao=-data&tam_pagina=${tam_pagina}`;
        if (dataInicial) url += `&dataPublicacaoDataInicial=${dataInicial.toString().includes('/') ? dataInicial.toString().split('/').reverse().join('-') : dataInicial.toString()}`;
        if (dataFinal) url += `&dataPublicacaoDataFinal=${dataFinal.toString().includes('/') ? dataFinal.toString().split('/').reverse().join('-') : dataFinal.toString()}`;
        const sit = (situacao === 'todas' || !situacao) ? '' : situacao;
        if (sit) url += `&situacao=${sit}`;

        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
        const { termo } = req.query;
        if (!termo) return res.status(400).json({ error: 'Termo de busca é obrigatório' });

        // Aumentando amostragem para 50 processos para maior precisão estatística
        const searchUrl = `${PNCP_SEARCH_URL}/?q=${termo}&tipos_documento=edital%7Cata%7Ccontrato&ordenacao=-data&pagina=1&tam_pagina=50&situacao=concluido`;
        const searchRes = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const processes = searchRes.data.items || [];

        const brandCounts: Record<string, { value: number; totalGasto: number }> = {};
        const keywords = termo.toString().toLowerCase().split(' ').filter(k => k.length > 2);

        await Promise.all(processes.map(async (proc: any) => {
            try {
                const itemsRes = await axios.get(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens`);
                const items = itemsRes.data || [];
                
                for (const item of items) {
                    const desc = (item.descricao || item.description || '').toLowerCase();
                    // Filtro RIGOROSO: Item DEVE conter as palavras-chave da busca
                    if (keywords.every(k => desc.includes(k))) {
                        let brand = extractBrand(item.descricao || item.description);
                        
                        // Busca profunda: Se não achou na descrição, tenta no resultado homologado (ONID)
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
                            if (!brandCounts[brand]) brandCounts[brand] = { value: 0, totalGasto: 0 };
                            brandCounts[brand].value++;
                            brandCounts[brand].totalGasto += (item.valorUnitarioEstimado || 0) * (item.quantidade || 0);
                        }
                    }
                }
            } catch (err) {}
        }));

        const results = Object.entries(brandCounts)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 20);

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
                const resultados: any = resResponse.data;
                if (resultados && resultados.length > 0) {
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

/**
 * GET /api/transparency/licitacoes/:cnpj/:ano/:sequencial/arquivos
 */
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
