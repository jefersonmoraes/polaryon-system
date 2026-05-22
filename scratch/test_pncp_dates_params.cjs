const axios = require('axios');

async function run() {
    const headers = { 'User-Agent': 'Mozilla/5.0' };
    const dateFormats = [
        { data_publicacao_inicial: '20260520', data_publicacao_final: '20260521' },
        { data_publicacao_inicial: '2026-05-20', data_publicacao_final: '2026-05-21' },
        { dataPublicacaoInicial: '20260520', dataPublicacaoFinal: '20260521' },
        { dataPublicacaoInicial: '2026-05-20', dataPublicacaoFinal: '2026-05-21' },
    ];

    for (const df of dateFormats) {
        try {
            const res = await axios.get("https://pncp.gov.br/api/search/?pagina=1&tam_pagina=10&status=recebendo_proposta&tipos_documento=edital", {
                params: df,
                headers
            });
            console.log(`Format: ${JSON.stringify(df)} -> Total: ${res.data.total}`);
            if (res.data.items && res.data.items.length > 0) {
                console.log(`  First item pub: ${res.data.items[0].data_publicacao_pncp}`);
                console.log(`  Last item pub: ${res.data.items[res.data.items.length - 1].data_publicacao_pncp}`);
            }
        } catch (e) {
            console.error(`Format ${JSON.stringify(df)} failed:`, e.message);
        }
    }
}

run();
