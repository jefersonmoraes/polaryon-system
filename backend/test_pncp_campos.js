const axios = require('axios');
async function run() {
    let url = 'https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=15';
    let res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
    console.log("NO STATUS:");
    for (const item of res.data.items) {
        console.log(`- ${item.situacao_nome} (${item.situacao_id}) | result: ${item.tem_resultado}`);
    }

    url = 'https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=15&status=3';
    try {
        res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
        console.log("\nSTATUS=3:");
        for (const item of res.data.items) {
            console.log(`- ${item.situacao_nome} (${item.situacao_id}) | result: ${item.tem_resultado}`);
        }
    } catch(e) { }

    url = 'https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=15&status=encerradas';
    try {
        res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
        console.log("\nSTATUS=encerradas:");
        for (const item of res.data.items) {
            console.log(`- ${item.situacao_nome} (${item.situacao_id}) | result: ${item.tem_resultado}`);
        }
    } catch(e) { }
}
run();
