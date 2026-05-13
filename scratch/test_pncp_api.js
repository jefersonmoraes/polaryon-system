
import axios from 'axios';

const SYSTEM_IDS = Array.from({length: 30}, (_, i) => i + 1);

async function test() {
    for (const id of SYSTEM_IDS) {
        try {
            const response = await axios.get('https://pncp.gov.br/api/search/', {
                params: {
                    id_sistema_origem: id,
                    tam_pagina: 1
                },
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000
            });
            if (response.data.total > 0) {
                console.log(`System ID ${id} -> Total: ${response.data.total}`);
                const item = response.data.items[0];
                const detailUrl = `https://pncp.gov.br/api/consulta/v1/orgaos/${item.orgao_cnpj}/compras/${item.ano}/${item.numero_sequencial}`;
                try {
                    const detailRes = await axios.get(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 3000 });
                    console.log(`   Link: ${detailRes.data.linkSistemaOrigem || 'No link'}`);
                } catch (e) {
                    console.log(`   Detail failed: ${e.message}`);
                }
            }
        } catch (e) {
            // console.error(`ID ${id} failed: ${e.message}`);
        }
    }
}

test();
