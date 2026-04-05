import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

// A API antiga do Comprasnet está retornando 404 (Descontinuada pelo Governo em favor do PNCP unificado)
// Vamos rotear a consulta do "Compras.gov.br" para o barramento PNCP buscando especificamente
// a esfera Federal (onde o Comprasnet opera) para manter o contrato da interface.
const PNCP_SEARCH_URL = 'https://pncp.gov.br/api/search/';

/**
 * GET /api/comprasgov/licitacoes
 * Busca unificada filtrando dados do escopo Federal (Compras.gov.br original)
 */
router.get('/licitacoes', async (req: Request, res: Response) => {
    try {

        const { offset = 0 } = req.query;
        // Paginação do PNCP é por página de 50 (ex: offset 0 = pag 1)
        const pagina = req.query.pagina ? Number(req.query.pagina) : Math.floor(Number(offset) / 50) + 1;
        
        const params: any = {
            ...req.query,
            pagina: pagina,
            tamanho_pagina: 50,
            esferas: ['F'],
            // Fallback params in case frontend doesn't send them
            status: req.query.status || ['recebendo_proposta', 'propostas_encerradas', 'encerradas'],
            tipos_documento: req.query.tipos_documento || ['edital', 'aviso_contratacao_direta']
        };
        delete params.offset;

        let url = `${PNCP_SEARCH_URL}`;

        const response = await axios.get(url, { 
            params: params,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 15000,
            paramsSerializer: (params) => {
                const searchParams = new URLSearchParams();
                for (const key in params) {
                    if (Array.isArray(params[key])) {
                        params[key].forEach((val: any) => searchParams.append(key, val));
                    } else if (params[key] !== undefined && params[key] !== null) {
                        searchParams.append(key, params[key]);
                    }
                }
                return searchParams.toString();
            }
        });
        
        // Mapear para o padrão PncpItem garantindo a etiqueta da fonte
        const items = (response.data?.items || []).map((l: any) => ({
            ...l,
            fonte_dados: 'Compras.gov.br'
        }));

        res.json({
            success: true,
            total: response.data?.totalRegistros || 0,
            items: items
        });
    } catch (error: any) {
        console.error('Compras.gov.br Adapter Proxy Error:', error.message);
        // Em vez de estourar 500 e quebrar a tela, retorna vazio gracefully se o PNCP falhar
        res.json({ success: false, total: 0, items: [], error: 'Falha no barramento federal' });
    }
});

export default router;
