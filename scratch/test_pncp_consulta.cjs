const axios = require('axios');

async function testPncpConsulta() {
    try {
        console.log('Testing PNCP API Consulta publicacao...');
        const res = await axios.get('https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao', {
            params: {
                data: '20260520',
                pagina: 1,
                tamanhoPagina: 10
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }
        });
        console.log('PNCP API Consulta Success!');
        console.log('Type of res.data:', typeof res.data);
        console.log('Content Preview:', JSON.stringify(res.data).substring(0, 1000));
    } catch (err) {
        console.error('PNCP API Consulta Error:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    }
}

testPncpConsulta();
