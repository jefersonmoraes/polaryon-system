
import axios from 'axios';

async function test() {
    try {
        const params = {
            q: 'bolsa de licitacoes',
            id_sistema_origem: 1, // Compras.gov
            pagina: 1,
            tam_pagina: 5,
            tipos_documento: 'edital',
            status: 'recebendo_proposta'
        };
        
        const url = 'https://pncp.gov.br/api/search/';
        const res = await axios.get(url, {
            params: params,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            paramsSerializer: (params) => {
                const parts = [];
                Object.entries(params).forEach(([key, val]) => {
                    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
                });
                return parts.join('&');
            }
        });
        
        console.log('Results with id_sistema_origem=1:', res.data.items.length);
        if (res.data.items.length > 0) {
            console.log('First item numero_controle_pncp:', res.data.items[0].numero_controle_pncp);
        }

        // Test with idSistemaOrigem (camelCase)
        params.idSistemaOrigem = 12;
        delete params.id_sistema_origem;
        const res2 = await axios.get(url, {
            params: params,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            paramsSerializer: (params) => {
                const parts = [];
                Object.entries(params).forEach(([key, val]) => {
                    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
                });
                return parts.join('&');
            }
        });
        console.log('Results with idSistemaOrigem=12:', res2.data.items.length);

    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
