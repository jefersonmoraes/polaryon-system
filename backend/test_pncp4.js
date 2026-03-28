const axios = require('axios');
async function run() {
    let url = 'https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=5&status=3';
    let res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
    console.log("status=3:", res.data.items.length);

    url = 'https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=5&status=1,2,3,4';
    try {
        res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
        console.log("status=1,2,3,4:", res.data.items.length);
    } catch(e) { console.log(e.message); }

    url = 'https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=5&status=encerradas';
    try {
        res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
        console.log("status=encerradas:", res.data.items.length);
    } catch(e) { console.log(e.message); }
}
run();
