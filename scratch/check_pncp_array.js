
import axios from 'axios';

async function test() {
    try {
        const url = 'https://pncp.gov.br/api/search/';
        // Try passing it as an array
        const params = {
            pagina: 1,
            tam_pagina: 10,
            tipos_documento: 'edital',
            status: 'recebendo_proposta',
            id_sistema_origem: [12] 
        };
        
        const res = await axios.get(url, {
            params: params,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            paramsSerializer: (params) => {
                let parts = [];
                Object.entries(params).forEach(([key, val]) => {
                    if (Array.isArray(val)) {
                        val.forEach(v => parts.push(`${encodeURIComponent(key)}=${v}`));
                    } else {
                        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
                    }
                });
                return parts.join('&');
            }
        });
        
        console.log('Results count:', res.data.items.length);
        if (res.data.items.length > 0) {
            console.log('IDs in results:', res.data.items.map(i => i.numero_controle_pncp.split('-')[1]).join(', '));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
