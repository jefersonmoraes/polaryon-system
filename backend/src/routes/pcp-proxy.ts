import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

const PCP_BASE_URL = 'https://apipcp.portaldecompraspublicas.com.br';
const PCP_PUBLIC_KEY = process.env.PCP_PUBLIC_KEY || '';

const pcpApi = axios.create({
    baseURL: PCP_BASE_URL,
    timeout: 15000,
    headers: { 'User-Agent': 'Polaryon-System/1.0' }
});

// Cache simples em memória (5 min)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key: string) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    cache.delete(key);
    return null;
}

function setCache(key: string, data: any) {
    cache.set(key, { data, ts: Date.now() });
    // Limpar caches antigos
    if (cache.size > 200) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 50);
        oldest.forEach(([k]) => cache.delete(k));
    }
}

/**
 * GET /api/transparency/pcp-listar
 * Lista licitações do PCP por data e situação
 */
router.get('/pcp-listar', async (req: Request, res: Response) => {
    try {
        if (!PCP_PUBLIC_KEY) {
            return res.status(500).json({ error: 'PCP_PUBLIC_KEY não configurada no .env' });
        }

        const { cdSituacao = '1', dataInicio, dataFim, pagina = '1' } = req.query;

        if (!dataInicio || !dataFim) {
            return res.status(400).json({ error: 'dataInicio e dataFim são obrigatórios (DD/MM/AAAA)' });
        }

        const cacheKey = `pcp-listar-${cdSituacao}-${dataInicio}-${dataFim}-${pagina}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const response = await pcpApi.get('/publico/listarProcessos/', {
            params: {
                publicKey: PCP_PUBLIC_KEY,
                cdSituacao,
                dataInicio,
                dataFim,
                pagina
            }
        });

        setCache(cacheKey, response.data);
        res.json(response.data);
    } catch (error: any) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.mensagem || error.message;
        console.error('[PCP] Erro ao listar processos:', message);
        res.status(status).json({ error: message });
    }
});

/**
 * GET /api/transparency/pcp-abertos
 * Processos abertos por UF e data
 */
router.get('/pcp-abertos', async (req: Request, res: Response) => {
    try {
        if (!PCP_PUBLIC_KEY) {
            return res.status(500).json({ error: 'PCP_PUBLIC_KEY não configurada no .env' });
        }

        const { dataInicio, dataFim, uf, pagina = '1' } = req.query;

        if (!dataInicio || !dataFim) {
            return res.status(400).json({ error: 'dataInicio e dataFim são obrigatórios' });
        }

        const cacheKey = `pcp-abertos-${dataInicio}-${dataFim}-${uf || 'all'}-${pagina}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const params: any = {
            publicKey: PCP_PUBLIC_KEY,
            dataInicio,
            dataFim,
            pagina
        };
        if (uf) params.uf = uf;

        const response = await pcpApi.get('/publico/processosabertos/', { params });

        setCache(cacheKey, response.data);
        res.json(response.data);
    } catch (error: any) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.mensagem || error.message;
        console.error('[PCP] Erro ao listar abertos:', message);
        res.status(status).json({ error: message });
    }
});

/**
 * GET /api/transparency/pcp-detalhe/:idLicitacao
 * Detalhe completo de um processo
 */
router.get('/pcp-detalhe/:idLicitacao', async (req: Request, res: Response) => {
    try {
        if (!PCP_PUBLIC_KEY) {
            return res.status(500).json({ error: 'PCP_PUBLIC_KEY não configurada no .env' });
        }

        const { idLicitacao } = req.params;
        const cacheKey = `pcp-detalhe-${idLicitacao}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const response = await pcpApi.get('/publico/obterprocesso/', {
            params: { publicKey: PCP_PUBLIC_KEY, idLicitacao }
        });

        setCache(cacheKey, response.data);
        res.json(response.data);
    } catch (error: any) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.mensagem || error.message;
        console.error('[PCP] Erro ao obter detalhe:', message);
        res.status(status).json({ error: message });
    }
});

/**
 * GET /api/transparency/pcp-anexos/:idLicitacao
 * Anexos e editais de uma licitação
 */
router.get('/pcp-anexos/:idLicitacao', async (req: Request, res: Response) => {
    try {
        if (!PCP_PUBLIC_KEY) {
            return res.status(500).json({ error: 'PCP_PUBLIC_KEY não configurada no .env' });
        }

        const { idLicitacao } = req.params;
        const cacheKey = `pcp-anexos-${idLicitacao}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const response = await pcpApi.get('/publico/obteranexoslicitacao/', {
            params: { publicKey: PCP_PUBLIC_KEY, idLicitacao }
        });

        setCache(cacheKey, response.data);
        res.json(response.data);
    } catch (error: any) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.mensagem || error.message;
        console.error('[PCP] Erro ao obter anexos:', message);
        res.status(status).json({ error: message });
    }
});

/**
 * GET /api/transparency/pcp-atas/:idLicitacao
 * Atas de registro de preços
 */
router.get('/pcp-atas/:idLicitacao', async (req: Request, res: Response) => {
    try {
        if (!PCP_PUBLIC_KEY) {
            return res.status(500).json({ error: 'PCP_PUBLIC_KEY não configurada no .env' });
        }

        const { idLicitacao } = req.params;
        const { tipoAta = '1' } = req.query;
        const cacheKey = `pcp-atas-${idLicitacao}-${tipoAta}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const response = await pcpApi.get('/publico/obterAtas/', {
            params: { publicKey: PCP_PUBLIC_KEY, idLicitacao, tipoAta }
        });

        setCache(cacheKey, response.data);
        res.json(response.data);
    } catch (error: any) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.mensagem || error.message;
        console.error('[PCP] Erro ao obter atas:', message);
        res.status(status).json({ error: message });
    }
});

/**
 * GET /api/transparency/pcp-status/:idLicitacao
 * Status do processo
 */
router.get('/pcp-status/:idLicitacao', async (req: Request, res: Response) => {
    try {
        if (!PCP_PUBLIC_KEY) {
            return res.status(500).json({ error: 'PCP_PUBLIC_KEY não configurada no .env' });
        }

        const { idLicitacao } = req.params;

        const response = await pcpApi.get('/publico/obterstatusprocesso/', {
            params: { publicKey: PCP_PUBLIC_KEY, idLicitacao }
        });

        res.json(response.data);
    } catch (error: any) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.mensagem || error.message;
        console.error('[PCP] Erro ao obter status:', message);
        res.status(status).json({ error: message });
    }
});

/**
 * GET /api/transparency/pcp-chat/:idLicitacao
 * Chat/dúvidas do processo
 */
router.get('/pcp-chat/:idLicitacao', async (req: Request, res: Response) => {
    try {
        if (!PCP_PUBLIC_KEY) {
            return res.status(500).json({ error: 'PCP_PUBLIC_KEY não configurada no .env' });
        }

        const { idLicitacao } = req.params;
        const { pagina = '1' } = req.query;

        const response = await pcpApi.get('/publico/obterchat/', {
            params: { publicKey: PCP_PUBLIC_KEY, idLicitacao, pagina }
        });

        res.json(response.data);
    } catch (error: any) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.mensagem || error.message;
        console.error('[PCP] Erro ao obter chat:', message);
        res.status(status).json({ error: message });
    }
});

export default router;
