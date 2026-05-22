import axios from 'axios';

async function run() {
    const url = "https://pncp.gov.br/api/search/?pagina=1&tam_pagina=20&status=recebendo_proposta&tipos_documento=edital&modalidades=8&ordenacao=-data_publicacao_pncp";
    try {
        const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const items = res.data.items || [];
        console.log(`Found ${items.length} dispensas sorted by -data_publicacao_pncp.`);
        items.forEach((d, idx) => {
            console.log(`\nDispensa ${idx + 1}:`);
            console.log(` - Title: ${d.title}`);
            console.log(` - Orgao: ${d.orgao_nome}`);
            console.log(` - data_publicacao_pncp: ${d.data_publicacao_pncp}`);
            console.log(` - data_encerramento_proposta: ${d.data_encerramento_proposta}`);
            console.log(` - data_fim_vigencia: ${d.data_fim_vigencia}`);
            console.log(` - data_inicio_vigencia: ${d.data_inicio_vigencia}`);
            console.log(` - data_inicio_proposta: ${d.data_inicio_proposta}`);
        });
    } catch (e) {
        console.error(e.message);
    }
}

run();
