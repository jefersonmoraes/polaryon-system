const axios = require('axios');

async function testPncpWithHeaders() {
    try {
        console.log('Testing PNCP API with realistic browser headers...');
        const res = await axios.get('https://pncp.gov.br/api/search/', {
            params: {
                tam_pagina: 10,
                pagina: 1,
                status: 'recebendo_proposta',
                tipos_documento: 'edital'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'Referer': 'https://pncp.gov.br/',
                'Origin': 'https://pncp.gov.br'
            }
        });
        console.log('PNCP Success with realistic headers!');
        console.log('Keys/Content Preview:', JSON.stringify(res.data).substring(0, 1000));
    } catch (err) {
        console.error('PNCP API Error:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.log('Keys/Content Preview:', JSON.stringify(err.response.data).substring(0, 1000));
        }
    }
}

testPncpWithHeaders();
