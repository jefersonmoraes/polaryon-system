import express, { Request, Response } from 'express';

const router = express.Router();

const PNCP_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
const PNCP_SEARCH_URL = 'https://pncp.gov.br/api/search';

/**
 * GET /api/transparency/licitacoes
 * Search biddings globally using PNCP Search API
 */
router.get('/licitacoes', async (req: Request, res: Response) => {
    try {
        const { pagina = '1', termo, dataInicial, dataFinal } = req.query;
        
        // PNCP Search API
        let url = `${PNCP_SEARCH_URL}/?q=${termo || ''}&pagina=${pagina}&tipos_documento=edital&ordenacao=-dataPublicacao`;
        if (dataInicial) url += `&data_inicial=${dataInicial.toString().replace(/\//g, '')}`;
        if (dataFinal) url += `&data_final=${dataFinal.toString().replace(/\//g, '')}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro na busca PNCP: ${response.status}`);
        const data: any = await response.json();

        // Map PNCP search results to a more friendly format
        const results = (data.data || []).map((item: any) => ({
            id: `${item.orgaoEntidade.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
            numeroLicitacao: `${item.numeroCompra}/${item.anoCompra}`,
            objeto: item.objeto,
            orgao: item.orgaoEntidade.razaoSocial,
            dataAbertura: item.dataPublicacao,
            valorLicitacao: item.valorTotalEstimado,
            situacao: item.situacaoCompraNome,
            cnpjOrgao: item.orgaoEntidade.cnpj,
            ano: item.anoCompra,
            sequencial: item.sequencialCompra
        }));

        res.json(results);
    } catch (error: any) {
        console.error('[Transparency Search Error]:', error.message);
        res.status(500).json({ error: 'Erro ao buscar no portal nacional: ' + error.message });
    }
});

/**
 * GET /api/transparency/licitacoes/:cnpj/:ano/:sequencial/itens
 * Fetch items and their winners for a specific bidding
 */
router.get('/licitacoes/:cnpj/:ano/:sequencial/itens', async (req: Request, res: Response) => {
    try {
        const { cnpj, ano, sequencial } = req.params;
        
        // 1. Fetch Items
        const itemsResponse = await fetch(`${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens`);
        if (!itemsResponse.ok) throw new Error(`Erro ao buscar itens: ${itemsResponse.status}`);
        const items: any = await itemsResponse.json();

        // 2. For each item, try to fetch results (winners)
        const detailedItems = await Promise.all(items.map(async (item: any) => {
            let vencedor = null;
            let marca = 'Não informada';

            if (item.temResultado) {
                try {
                    const resResponse = await fetch(`${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/${item.numeroItem}/resultados`);
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
                } catch (e) {
                    console.warn(`Could not fetch result for item ${item.numeroItem}`);
                }
            }

            // Simple heuristic to find brand in description if not a separate field
            const brandMatch = item.descricao.match(/Marca:\s*([^;,\n]+)/i);
            if (brandMatch) {
                marca = brandMatch[1].trim();
            }

            return {
                numero: item.numeroItem,
                descricao: item.descricao,
                quantidade: item.quantidade,
                valorUnitario: item.valorUnitarioEstimado,
                vencedor,
                marca: marca || 'Ver detalhes no edital'
            };
        }));

        res.json(detailedItems);
    } catch (error: any) {
        console.error('[Transparency Items Error]:', error.message);
        res.status(500).json({ error: 'Erro ao buscar itens: ' + error.message });
    }
});

export default router;
