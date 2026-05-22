const axios = require('axios');

async function test() {
    const urls = [
        // 1. Without dates
        'https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&pagina=1&tam_pagina=5',
        // 2. With data_publicacao_inicial and data_publicacao_final
        'https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&pagina=1&tam_pagina=5&data_publicacao_inicial=20260401&data_publicacao_final=20260430',
        // 3. With dataPublicacaoInicial and dataPublicacaoFinal
        'https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&pagina=1&tam_pagina=5&dataPublicacaoInicial=20260401&dataPublicacaoFinal=20260430',
        // 4. With dataInicial and dataFinal
        'https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&pagina=1&tam_pagina=5&dataInicial=20260401&dataFinal=20260430',
    ];

    for (let i = 0; i < urls.length; i++) {
        try {
            const res = await axios.get(urls[i], {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            console.log(`URL ${i + 1}: total = ${res.data.total}, items count = ${res.data.items?.length}`);
            if (res.data.items && res.data.items.length > 0) {
                console.log(`  First item pub date: ${res.data.items[0].data_publicacao_pncp || res.data.items[0].dataPublicacaoPncp}`);
            }
        } catch (e) {
            console.error(`URL ${i + 1} Error:`, e.message);
        }
    }
}

test();
