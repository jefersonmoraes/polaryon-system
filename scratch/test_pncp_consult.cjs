const axios = require('axios');

async function test() {
    const urls = [
        'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20260401&dataFinal=20260402&pagina=1&tamanhoPagina=5',
        'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20260401&dataFinal=20260402&pagina=1&tamanhoPagina=5&codigoModalidadeContratacao=6',
    ];

    for (let i = 0; i < urls.length; i++) {
        try {
            const res = await axios.get(urls[i], {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            console.log(`URL ${i + 1} Success: data length = ${res.data?.data?.length || res.data?.length || 0}`);
            if (res.data) {
                console.log(`  Keys: ${Object.keys(res.data).join(', ')}`);
                const items = res.data.data || res.data;
                if (Array.isArray(items) && items.length > 0) {
                    console.log(`  First item title: ${items[0].objeto || items[0].description}`);
                }
            }
        } catch (e) {
            console.error(`URL ${i + 1} Error:`, e.response?.status, e.response?.data || e.message);
        }
    }
}

test();
