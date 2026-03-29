const axios = require('axios');
const PNCP_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
(async () => {
    try {
        const searchRes = await axios.get('https://pncp.gov.br/api/search/?q=computador&tipos_documento=edital&pagina=1&tam_pagina=1&status=encerradas');
        const proc = searchRes.data.items.find(p => p.tem_resultado);
        if(!proc) {console.log("no match"); return;}
        const itemsRes = await axios.get(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens`);
        const item = itemsRes.data.find(i => i.temResultado);
        if(!item) {console.log("no item"); return;}
        console.log("ITEM BRUTO marca:", item.marca);
        const rRes=await axios.get(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens/${item.numeroItem}/resultados`);
        console.log("RESULTADO KEYS:", Object.keys(rRes.data[0]));
        console.log("winner.marca:", rRes.data[0].marca, "winner.marcaFornecedor:", rRes.data[0].marcaFornecedor);
    }catch(e){console.log(e.message)}
})();
