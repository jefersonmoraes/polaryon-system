const axios = require('axios');

async function checkPncpCors() {
    try {
        console.log('Testing PNCP API CORS headers...');
        const res = await axios.get('https://pncp.gov.br/api/search/', {
            params: {
                tam_pagina: 1,
                pagina: 1
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Origin': 'https://polaryon.com.br' // Simulate web client origin
            }
        });
        console.log('CORS test response headers:');
        console.log('Access-Control-Allow-Origin:', res.headers['access-control-allow-origin']);
        console.log('Access-Control-Allow-Methods:', res.headers['access-control-allow-methods']);
    } catch (err) {
        console.error('CORS test error:', err.message);
        if (err.response) {
            console.log('Access-Control-Allow-Origin in error headers:', err.response.headers['access-control-allow-origin']);
        }
    }
}

checkPncpCors();
