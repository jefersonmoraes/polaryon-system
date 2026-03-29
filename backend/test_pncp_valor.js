const axios = require('axios');

async function run() {
    let url = 'https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=50&status=encerradas';
    let res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    
    const items = res.data.items || [];
    console.log(`Puxamos ${items.length} itens da API Busca`);
    
    const validos = items.filter(i => i.tem_resultado === true && Number(i.valor_global || 0) > 0);
    const falsos = items.filter(i => i.tem_resultado === true && Number(i.valor_global || 0) === 0);

    console.log(`Itens com valor > 0: ${validos.length}`);
    for (const v of validos.slice(0,3)) console.log(` - ${v.title.substring(0,30)} | R$ ${v.valor_global} | ${v.situacao_nome}`);

    console.log(`Itens com valor == 0: ${falsos.length}`);
    for (const f of falsos.slice(0,3)) console.log(` - ${f.title.substring(0,30)} | R$ ${f.valor_global} | ${f.situacao_nome}`);
}

run();
