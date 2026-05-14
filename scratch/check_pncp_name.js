
import axios from 'axios';

async function test() {
    try {
        const url = 'https://pncp.gov.br/api/search/';
        const params = {
            pagina: 1,
            tam_pagina: 10,
            tipos_documento: 'edital',
            status: 'recebendo_proposta',
            sistema_origem: 'BLL' // Try name instead of ID
        };
        
        const res = await axios.get(url, {
            params: params,
            headers: { 'User-Agent': 'Mozilla/5.0' }
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
