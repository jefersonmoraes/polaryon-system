import axios from 'axios';

async function testOrdering() {
    const variants = [
        { name: 'no ordenacao', params: {} },
        { name: 'ordenacao=-data', params: { ordenacao: '-data' } },
        { name: 'ordenacao=data', params: { ordenacao: 'data' } },
        { name: 'ordenacao=-data_publicacao_pncp', params: { ordenacao: '-data_publicacao_pncp' } },
        { name: 'ordenacao=data_publicacao_pncp', params: { ordenacao: 'data_publicacao_pncp' } },
        { name: 'ordenacao=-dataPublicacaoPncp', params: { ordenacao: '-dataPublicacaoPncp' } },
        { name: 'ordenacao=dataPublicacaoPncp', params: { ordenacao: 'dataPublicacaoPncp' } }
    ];

    for (const variant of variants) {
        try {
            const url = 'https://pncp.gov.br/api/search/?pagina=1&tam_pagina=3&tipos_documento=edital&status=recebendo_proposta';
            const res = await axios.get(url, {
                params: variant.params,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            console.log(`Variant: ${variant.name}`);
            res.data.items.slice(0, 2).forEach((item, idx) => {
                console.log(`  [${idx}] ${item.title} -> Pub: ${item.data_publicacao_pncp}`);
            });
        } catch (e) {
            console.log(`Variant: ${variant.name} -> FAILED:`, e.message);
        }
    }
}

testOrdering();
