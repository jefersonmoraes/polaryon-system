const axios = require('axios');

async function run() {
    const headers = { 'User-Agent': 'Mozilla/5.0' };
    try {
        const resEdital = await axios.get("https://pncp.gov.br/api/search/?pagina=1&tam_pagina=10&status=recebendo_proposta&tipos_documento=edital&modalidades=8", { headers });
        console.log("Total for tipos_documento=edital:", resEdital.data.total);

        const resAviso = await axios.get("https://pncp.gov.br/api/search/?pagina=1&tam_pagina=10&status=recebendo_proposta&tipos_documento=aviso_contratacao_direta&modalidades=8", { headers });
        console.log("Total for tipos_documento=aviso_contratacao_direta:", resAviso.data.total);

        const resBoth = await axios.get("https://pncp.gov.br/api/search/?pagina=1&tam_pagina=10&status=recebendo_proposta&tipos_documento=edital|aviso_contratacao_direta&modalidades=8", { headers });
        console.log("Total for tipos_documento=edital|aviso_contratacao_direta:", resBoth.data.total);
    } catch (e) {
        console.error(e.message);
    }
}

run();
