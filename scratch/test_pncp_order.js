import axios from 'axios';

async function testOrdering() {
    try {
        // Try ordering by data_publicacao_pncp desc
        const url1 = 'https://pncp.gov.br/api/search/?pagina=1&tam_pagina=5&tipos_documento=edital&status=recebendo_proposta&ordenacao=-data';
        const res1 = await axios.get(url1, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log('Order by -data:');
        res1.data.items.slice(0, 3).forEach(item => {
            console.log(`  ${item.title} -> Pub: ${item.data_publicacao_pncp}`);
        });

        // Try ordering by -data_publicacao_pncp
        const url2 = 'https://pncp.gov.br/api/search/?pagina=1&tam_pagina=5&tipos_documento=edital&status=recebendo_proposta&ordenacao=-data_publicacao_pncp';
        const res2 = await axios.get(url2, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log('\nOrder by -data_publicacao_pncp:');
        res2.data.items.slice(0, 3).forEach(item => {
            console.log(`  ${item.title} -> Pub: ${item.data_publicacao_pncp}`);
        });

        // Try ordering by data_publicacao_pncp asc
        const url3 = 'https://pncp.gov.br/api/search/?pagina=1&tam_pagina=5&tipos_documento=edital&status=recebendo_proposta&ordenacao=data_publicacao_pncp';
        const res3 = await axios.get(url3, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log('\nOrder by data_publicacao_pncp:');
        res3.data.items.slice(0, 3).forEach(item => {
            console.log(`  ${item.title} -> Pub: ${item.data_publicacao_pncp}`);
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testOrdering();
