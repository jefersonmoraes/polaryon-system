
import axios from 'axios';

async function test() {
    try {
        const url = 'https://pncp.gov.br/api/search/';
        const params = {
            pagina: 1,
            tam_pagina: 10,
            tipos_documento: 'edital',
            q: 'Bolsa Licitações'
        };
        
        const res = await axios.get(url, {
            params: params,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        console.log('Results count:', res.data.items.length);
        if (res.data.items.length > 0) {
             console.log('First item title:', res.data.items[0].title);
             console.log('First item ID:', res.data.items[0].numero_controle_pncp);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
