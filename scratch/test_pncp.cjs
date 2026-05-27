const axios = require('axios');

async function testPncp() {
    try {
        console.log('Testing PNCP direct API request...');
        const res = await axios.get('https://pncp.gov.br/api/search/', {
            params: {
                tam_pagina: 10,
                pagina: 1,
                status: 'recebendo_proposta',
                tipos_documento: 'edital'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }
        });
        console.log('Type of res.data:', typeof res.data);
        console.log('Keys/Content Preview:', JSON.stringify(res.data).substring(0, 1000));
    } catch (err) {
        console.error('PNCP Direct API Error:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    }
}

testPncp();
