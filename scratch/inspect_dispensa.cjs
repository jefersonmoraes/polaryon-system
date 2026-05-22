const axios = require('axios');

async function run() {
    const url = "https://pncp.gov.br/api/search/?pagina=1&tam_pagina=3&status=recebendo_proposta&tipos_documento=edital&modalidades=8&ordenacao=-data_publicacao_pncp";
    try {
        const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const items = res.data.items || [];
        console.log(`Found ${items.length} items`);
        if (items.length > 0) {
            console.log(JSON.stringify(items[0], null, 2));
        }
    } catch (e) {
        console.error(e.message);
    }
}

run();
