const axios = require('axios');

async function check() {
    try {
        const res = await axios.get('https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&pagina=1&tam_pagina=1', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const item = res.data.items?.[0];
        if (item) {
            console.log("Keys:");
            console.log(JSON.stringify(Object.keys(item), null, 2));
            console.log("\nSample dates and values:");
            console.log(`data_publicacao_pncp: ${item.data_publicacao_pncp}`);
            console.log(`data_inicio_vigencia: ${item.data_inicio_vigencia}`);
            console.log(`data_fim_vigencia: ${item.data_fim_vigencia}`);
            console.log(`data_encerramento_proposta: ${item.data_encerramento_proposta}`);
            console.log(`dataEncerramentoProposta: ${item.dataEncerramentoProposta}`);
            console.log(`dataFimVigencia: ${item.dataFimVigencia}`);
        } else {
            console.log("No items found.");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

check();
