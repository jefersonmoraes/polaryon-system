import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

// A API antiga do Comprasnet que ainda tem forte catálogo de histórico
const COMPRAS_BASE_URL = 'http://compras.dados.gov.br/licitacoes/v1';

/**
 * GET /api/comprasgov/licitacoes
 * Busca unificada mapeada para a interface PncpItem do Frontend
 */
router.get('/licitacoes', async (req: Request, res: Response) => {
    try {
        const { offset = 0, uasg, data_publicacao } = req.query;
        let url = `${COMPRAS_BASE_URL}/licitacoes.json?offset=${offset}`;
        
        if (uasg) url += `&uasg=${uasg}`;
        if (data_publicacao) url += `&data_publicacao=${data_publicacao}`;

        const response = await axios.get(url, { timeout: 10000 });
        
        // Mapear para o padrão PNCP PncpItem (Adapter Pattern)
        const items = (response.data?._embedded?.licitacoes || []).map((l: any) => ({
            id: l.identificador,
            title: `Licitação ${l.modalidade} ${l.numero_aviso}`,
            description: l.objeto,
            item_url: `http://comprasnet.gov.br/ConsultaLicitacoes/download/download_editais_detalhe.asp?numprp=${l.numero_aviso}&codigoModalidade=${l.codigo_modalidade}&daUasg=${l.uasg}`,
            orgao_nome: 'UASG (Cód: ' + l.uasg + ')',
            orgao_cnpj: l.identificador,
            esfera_nome: 'Federal',
            poder_nome: 'Executivo',
            municipio_nome: 'Nação',
            uf: 'BR',
            situacao_nome: l.situacao_aviso || 'Aberto',
            data_publicacao_pncp: l.data_entrega_edital,
            data_encerramento_proposta: l.data_abertura_proposta,
            modalidade_licitacao_nome: `Modalidade ${l.codigo_modalidade}`,
            fonte_dados: 'Compras.gov.br'
        }));

        res.json({
            success: true,
            total: response.data?.count || 0,
            items: items
        });
    } catch (error: any) {
        console.error('Compras.gov.br API Error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar dados do Compras.gov.br' });
    }
});

export default router;
