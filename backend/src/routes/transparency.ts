import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const API_BASE_URL = 'https://api.portaldatransparencia.gov.br/api-de-dados';
const API_TOKEN = process.env.PORTAL_TRANSPARENCIA_TOKEN || '';

// Proxy helper
const fetchFromGov = async (endpoint: string) => {
    if (!API_TOKEN) {
        throw new Error('API Token [PORTAL_TRANSPARENCIA_TOKEN] não configurado no .env do backend.');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
            'chave-api-dados': API_TOKEN,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na API do Governo (${response.status}): ${errorText}`);
    }

    return response.json();
};

/**
 * GET /api/transparency/licitacoes
 * Query params support: pagina, dataInicial, dataFinal, codigoOrgao
 * Note: Keywords usually handled by fetching and filtering if API limitations exist
 */
router.get('/licitacoes', async (req: Request, res: Response) => {
    try {
        const { pagina = '1', dataInicial, dataFinal, codigoOrgao } = req.query;
        
        let url = `/licitacoes?pagina=${pagina}`;
        if (dataInicial) url += `&dataInicial=${dataInicial}`;
        if (dataFinal) url += `&dataFinal=${dataFinal}`;
        if (codigoOrgao) url += `&codigoOrgao=${codigoOrgao}`;

        const data = await fetchFromGov(url);
        res.json(data);
    } catch (error: any) {
        console.error('[Transparency API Error]:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/transparency/licitacoes/:id/itens
 * Fetch items, winners, and brands for a specific bidding
 */
router.get('/licitacoes/:id/itens', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = await fetchFromGov(`/licitacoes/${id}/itens`);
        res.json(data);
    } catch (error: any) {
        console.error('[Transparency API Items Error]:', error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
