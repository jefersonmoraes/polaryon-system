import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();
const TRANSPARENCY_API_URL = 'https://api.portaldatransparencia.gov.br/api-de-dados';
const TOKEN = process.env.PORTAL_TRANSPARENCIA_TOKEN;

const api = axios.create({
    baseURL: TRANSPARENCY_API_URL,
    headers: {
        'chave-api-dados': TOKEN || ''
    },
    timeout: 15000
});

/**
 * GET /api/transferegov/convenios
 * Retorna lista de convênios/repasses do Portal da Transparência (Preditivo)
 */
router.get('/convenios', async (req: Request, res: Response) => {
    try {
        const { 
            pagina = 1, 
            dataInicial, 
            dataFinal, 
            uf, 
            codigoOrgao,
            valorMin,
            valorMax,
            tipoInstrumento 
        } = req.query;

        // Regra da API: Requer dataInicial e dataFinal se não houver outros filtros fortes.
        // Se o usuário não mandou, pegamos o mês atual por padrão.
        let dIn = dataInicial as string;
        let dFi = dataFinal as string;

        if (!dIn || !dFi) {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            const fmt = (d: Date) => d.toLocaleDateString('pt-BR');
            dIn = fmt(firstDay);
            dFi = fmt(lastDay);
        }

        const params: any = {
            pagina,
            dataInicial: dIn,
            dataFinal: dFi
        };

        if (uf) params.uf = uf;
        if (codigoOrgao) params.codigoOrgao = codigoOrgao;
        if (valorMin) params.valorTotalDe = valorMin;
        if (valorMax) params.valorTotalAte = valorMax;
        if (tipoInstrumento) params.tipoInstrumento = tipoInstrumento;

        const response = await api.get('/convenios', { params });
        
        // Mapear para um formato amigável para o Dashboard Preditivo
        const mapped = (response.data || []).map((c: any) => ({
            id: c.id,
            numero: c.numero || 'S/N',
            objeto: c.objeto || 'Objeto não detalhado pelo convênio',
            valor: c.valor || 0,
            valorLiberado: c.valorLiberado || 0,
            valorContrapartida: c.valorContrapartida || 0,
            dataInicio: c.dataInicioVigencia || '',
            dataFim: c.dataFimVigencia || '',
            processo: c.numeroProcesso || '-',
            concedente: c.orgaoSuperiorConcedente?.nome || 'Órgão Federal',
            orgaoVinculado: c.unidadeGestora?.orgaoVinculado?.nome || c.orgaoSuperiorConcedente?.nome,
            convenente: c.convenente?.nome || 'Entidade Convenente',
            cnpjConvenente: c.convenente?.cnpjFormatado || '',
            uf: c.convenente?.uf?.sigla || '--',
            municipio: c.convenente?.municipio?.nome || 'Município',
            situacao: c.situacao || 'Em Análise',
            tipoInstrumento: c.tipoInstrumento?.descricao || 'Transferência',
            funcao: c.subfuncao?.funcao?.descricaoFuncao || 'N/A',
            subfuncao: c.subfuncao?.descricaoSubfuncap || 'N/A',
            statusPredicao: 'ALTA_PROBABILIDADE' 
        }));

        res.json({
            success: true,
            total: mapped.length,
            items: mapped
        });

    } catch (error: any) {
        console.error('Transferegov API Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Falha ao conectar com o barramento de convênios federal.',
            details: error.message 
        });
    }
});

/**
 * GET /api/transferegov/tipo-instrumento
 * Auxiliar para popular o filtro de tipos.
 */
router.get('/tipo-instrumento', async (req: Request, res: Response) => {
    try {
        const response = await api.get('/convenios/tipo-instrumento');
        res.json(response.data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
