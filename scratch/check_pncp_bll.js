import axios from 'axios';

async function checkBll() {
    try {
        const res = await axios.get('https://pncp.gov.br/api/search/?pagina=1&tam_pagina=10&tipos_documento=edital&q=BLL', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        console.log('Search Results:');
        res.data.items.forEach(item => {
            console.log('---');
            console.log('Title:', item.title);
            console.log('idSistemaOrigem:', item.idSistemaOrigem);
            console.log('sistema_origem:', item.sistema_origem);
            console.log('link:', item.link);
            console.log('item_url:', item.item_url);
        });
    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) {
            console.error('Data:', JSON.stringify(e.response.data, null, 2));
        }
    }
}

checkBll();
