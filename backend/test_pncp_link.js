const axios = require('axios');

async function run() {
    try {
        const url = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/15397806000062026/itens';
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Dart/2.14 (dart:io)',
                'Accept': 'application/json',
                'Device-Id': '1234567890'
            }
        });
        const data = res.data;
        console.log("STATUS CODE:", res.status);
        console.log("DATA LENGTH:", data ? data.length : 'no data');
        console.log("FIRST ITEM:", data ? JSON.stringify(data[0]).substring(0,200) : null);
        console.log("linkSistemaOrigem: ", data.linkSistemaOrigem);
    } catch (e) {
        console.error(e);
    }
}
run();
