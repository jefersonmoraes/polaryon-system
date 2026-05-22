const axios = require('axios');

async function test() {
    const paramsList = [
        { data_publicacao_inicial: '20260401', data_publicacao_final: '20260410' },
        { dataPublicacaoInicial: '20260401', dataPublicacaoFinal: '20260410' },
        { data_inicial: '20260401', data_final: '20260410' },
        { dataInicial: '20260401', dataFinal: '20260410' },
        { data_encerramento_inicial: '20260401', data_encerramento_final: '20260410' },
        { dataEncerramentoInicial: '20260401', dataEncerramentoFinal: '20260410' },
    ];

    for (let i = 0; i < paramsList.length; i++) {
        try {
            const res = await axios.get('https://pncp.gov.br/api/search/', {
                params: {
                    q: 'computador',
                    tipos_documento: 'edital',
                    pagina: 1,
                    tam_pagina: 5,
                    ...paramsList[i]
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 5000
            });
            console.log(`Params ${i + 1}: ${JSON.stringify(paramsList[i])}`);
            console.log(`  total = ${res.data.total}, items = ${res.data.items?.length}`);
            if (res.data.items && res.data.items.length > 0) {
                console.log(`  First item pub date: ${res.data.items[0].data_publicacao_pncp}`);
            }
        } catch (e) {
            console.log(`Params ${i + 1} Error:`, e.message);
        }
    }
}

test();
