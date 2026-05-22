const axios = require('axios');

async function test() {
    const queries = [
        'data_publicacao_pncp:[2026-04-01 TO 2026-04-10]',
        'data_fim_vigencia:[2026-05-20 TO 2026-05-25]',
        'computador AND data_publicacao_pncp:[2026-04-01 TO 2026-04-30]',
    ];

    for (let i = 0; i < queries.length; i++) {
        try {
            const res = await axios.get('https://pncp.gov.br/api/search/', {
                params: {
                    q: queries[i],
                    tipos_documento: 'edital',
                    pagina: 1,
                    tam_pagina: 5
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 5000
            });
            console.log(`Query ${i + 1}: "${queries[i]}"`);
            console.log(`  total = ${res.data.total}, items = ${res.data.items?.length}`);
            if (res.data.items && res.data.items.length > 0) {
                console.log(`  First item title: ${res.data.items[0].title}`);
                console.log(`  First item pub date: ${res.data.items[0].data_publicacao_pncp}`);
                console.log(`  First item end date: ${res.data.items[0].data_fim_vigencia}`);
            }
        } catch (e) {
            console.log(`Query ${i + 1} Error:`, e.message);
        }
    }
}

test();
