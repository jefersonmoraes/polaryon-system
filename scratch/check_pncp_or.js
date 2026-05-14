
import axios from 'axios';

async function test() {
    try {
        const url = 'https://pncp.gov.br/api/search/';
        const params = {
            pagina: 1,
            tam_pagina: 10,
            q: 'BLL|SIGA' // Test OR logic
        };
        
        const res = await axios.get(url, {
            params: params,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        console.log('Results count:', res.data.items.length);
        if (res.data.items.length > 0) {
             console.log('Titles:', res.data.items.map(i => i.title).join(', '));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
