const axios = require('axios');
async function run() {
    const url = 'https://pncp.gov.br/api/search/?q=*&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=12&status=encerradas';
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
    console.log("Total received:", res.data.items.length);
    for (const item of res.data.items) {
        console.log(`- ${String(item.title).substring(0,30)} | status: ${item.situacao_nome} (${item.situacao_id}) | result: ${item.tem_resultado}`);
    }
}
run();
