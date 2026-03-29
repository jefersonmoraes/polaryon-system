const axios = require('axios');
const PNCP_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
(async () => {
    try {
        const rRes=await axios.get('https://pncp.gov.br/api/pncp/v1/orgaos/23472061000109/compras/2026/19/itens/1/resultados');
        console.log(JSON.stringify(rRes.data[0], null, 2));
    }catch(e){console.log(e.message)}
})();
