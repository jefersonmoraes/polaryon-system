import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

const PNCP_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
const PNCP_SEARCH_URL = 'https://pncp.gov.br/api/search/';

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

/**
 * GET /api/transparency/licitacoes
 */
router.get('/licitacoes', async (req: Request, res: Response) => {
    try {
        const { pagina = '1', termo, dataInicial, dataFinal, situacao = 'concluido', tam_pagina = '10' } = req.query;
        let url = `${PNCP_SEARCH_URL}/?q=${termo || ''}&pagina=${pagina}&tipos_documento=edital%7Cata%7Ccontrato%7Cpcaorgao&ordenacao=-data&tam_pagina=${tam_pagina}`;
        if (dataInicial) url += `&dataPublicacaoDataInicial=${dataInicial}`;
        if (dataFinal) url += `&dataPublicacaoDataFinal=${dataFinal}`;
        const sit = (situacao === 'todas' || !situacao) ? '' : situacao;
        if (sit) url += `&situacao=${sit}`;

        const response = await axios.get(url, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }, 
            timeout: 15000 
        });
        const data: any = response.data;
        
        // CORREÇÃO: Limitar a 50 conforme pedido pelo usuário para foco nos últimos processos
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
        
        // Limite de 20 processos para o ranking para garantir carregamento instantâneo (< 5s)
        const fetchLimit = 20; 
        const allProcesses: any[] = [];
        
        try {
            let searchUrl = `${PNCP_SEARCH_URL}/?q=${termo}&tipos_documento=edital%7Cata%7Ccontrato&ordenacao=-data&pagina=1&tam_pagina=${fetchLimit}&situacao=concluido`;
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
                allProcesses.push(...searchRes.data.items);
            }
        } catch (e: any) { console.error('Error in ranking search:', e.message); }

        const processBatch = async (proc: any) => {
            try {
                // Determinar endpoint correto baseado no tipo de documento
                const isContrato = proc.document_type === 'contrato';
                const typePath = isContrato ? 'contratos' : 'compras';
                const itemsUrl = `${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/${typePath}/${proc.ano}/${proc.numero_sequencial}/itens`;
                
                const itemsRes = await axios.get(itemsUrl, { timeout: 4000 });
                const items = itemsRes.data || [];
                
                // Analisar no máximo os 20 primeiros itens de cada licitação para evitar lentidão
                for (const item of items.slice(0, 20)) {
                    const desc = (item.descricao || item.description || '').toLowerCase();
                    const matchCount = keywords.filter(k => desc.includes(k)).length;
                    const isMatch = keywords.length === 0 || (matchCount >= Math.ceil(keywords.length / 2)) || (keywords.length > 0 && desc.includes(keywords[0]));
                    
                    if (isMatch) {
                        let brand = extractBrand(item.descricao || item.description || '');
                        
                        if ((brand === 'N/A' || !brand) && item.marca) {
                            brand = item.marca.toUpperCase().trim();
                        }
                        
                        if (brand && brand !== 'N/A' && brand.length > 2) {
                            if (!brandCounts[brand]) brandCounts[brand] = { value: 0, totalGasto: 0 };
                            brandCounts[brand].value++;
                            const unitPrice = item.valorUnitarioEstimado || item.valorUnitario || 0;
                            brandCounts[brand].totalGasto += unitPrice * (item.quantidade || 0);
                        }
                    }
                }
            } catch (err) {}
        };

        // Processar em pequenos pedaços (chunks) de 2 paralelos para não estourar limite do PNCP nem do VPS
        const chunkSize = 2;
        for (let i = 0; i < allProcesses.length; i += chunkSize) {
            const chunk = allProcesses.slice(i, i + chunkSize);
            await Promise.all(chunk.map(proc => processBatch(proc)));
        }

        const results = Object.entries(brandCounts)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 30);
        res.json({ results, version: '2026-03-24-v3' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Itens e Arquivos
 */
router.get('/licitacoes/:cnpj/:ano/:sequencial/itens', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        const { termo } = req.query;
        const keywords = (termo || '').toString().toLowerCase().split(' ').filter(k => k.length > 2);
        const response = await axios.get(`${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens`);
        const items = response.data || [];
        const filteredItems = items.filter((item: any) => {
            if (keywords.length === 0) return true;
            const desc = (item.descricao || item.description || '').toLowerCase();
            return keywords.every(k => desc.includes(k));
        });
        const detailedItems = await Promise.all(filteredItems.map(async (item: any) => {
            let vencedor = null;
            let marca = extractBrand(item.descricao || item.description);
            try {
                const rr = await axios.get(`${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/${item.numeroItem}/resultados`);
                if (rr.data && rr.data.length > 0) {
                    const winner = rr.data[0];
                    vencedor = { nome: winner.nomeRazaoSocialFornecedor, cnpj: winner.niFornecedor, valor: winner.valorTotalHomologado };
                    if (marca === 'N/A' && winner.marcaFornecedor) marca = winner.marcaFornecedor.toUpperCase().trim();
                }
            } catch (e) {}
            return {
                numero: item.numeroItem, descricao: item.descricao || item.description,
                quantidade: item.quantidade, valorUnitario: item.valorUnitarioEstimado,
                vencedor, marca
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
        const files = (response.data || []).map((file: any) => ({
            id: file.id, nome: file.titulo,
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
