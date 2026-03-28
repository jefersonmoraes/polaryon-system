const axios = require('axios');
async function run() {
    let url = 'https://pncp.gov.br/api/search/?q=*&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=5';
    let res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
    console.log("No status param:", res.data.items.length);
    for (const item of res.data.items) {
        console.log(`- ${item.situacao_nome} (${item.situacao_id}) | result: ${item.tem_resultado}`);
    }

    url = 'https://pncp.gov.br/api/search/?q=*&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=5&status=3';
    try {
        res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
        console.log("status=3:", res.data.items.length);
    } catch(e) { console.log("status=3 Error", e.response?.status); }
}
run();
