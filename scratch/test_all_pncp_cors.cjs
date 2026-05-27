const axios = require('axios');

async function checkAllPncpCors() {
    const urls = [
        'https://pncp.gov.br/api/consulta/v1/orgaos/00394460000141/compras/2024/1',
        'https://pncp.gov.br/api/pncp/v1/orgaos/00394460000141/compras/2024/1/itens/quantidade',
        'https://pncp.gov.br/api/pncp/v1/orgaos/00394460000141/compras/2024/1/itens?pagina=1&tamanhoPagina=100',
        'https://pncp.gov.br/api/pncp/v1/orgaos/00394460000141/compras/2024/1/arquivos?pagina=1&tamanhoPagina=100'
    ];

    for (const url of urls) {
        try {
            console.log(`Testing CORS for: ${url}`);
            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Origin': 'https://polaryon.com.br'
                }
            });
            console.log('  Access-Control-Allow-Origin:', res.headers['access-control-allow-origin']);
        } catch (err) {
            console.error(`  Error: ${err.message}`);
            if (err.response) {
                console.log('  Access-Control-Allow-Origin in error:', err.response.headers['access-control-allow-origin']);
            }
        }
    }
}

checkAllPncpCors();
