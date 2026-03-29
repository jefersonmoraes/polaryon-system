const axios = require('axios');
const PNCP_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
const PNCP_SEARCH_URL = 'https://pncp.gov.br/api/search/';

(async () => {
    let searchUrl = `${PNCP_SEARCH_URL}?q=arroz&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=20&status=encerradas`;
    const searchRes = await axios.get(searchUrl);
    const processos = searchRes.data.items.filter(p => p.tem_resultado === true);
    console.log(`Encontrados ${processos.length} processos concluídos.`);
    for (const proc of processos.slice(0, 5)) {
        console.log(`\nProc ${proc.orgao_cnpj}/${proc.ano}/${proc.numero_sequencial} - ${proc.orgao_nome}`);
        try {
            const itemsRes = await axios.get(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens?pagina=1&tamanhoPagina=100`);
            for(const item of (itemsRes.data || [])) {
                if (item.descricao.toLowerCase().includes('arroz')) {
                    console.log(` -> ITEM: ${item.descricao} | Marca Obj: ${item.marca}`);
                    if(item.temResultado) {
                        try {
                            const rRes=await axios.get(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens/${item.numeroItem}/resultados`);
                            if(rRes.data && rRes.data.length>0) console.log(` => Result Marca Ganhadora: ${rRes.data[0].marcaFornecedor}`);
                        }catch(e){}
                    }
                }
            }
        }catch(e){}
    }
})();
