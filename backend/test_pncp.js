const testPNCP = async () => {
    const q = 'Notebook';
    // Test URL without date filters first
    const url = `https://pncp.gov.br/api/search/?q=${q}&tipos_documento=edital%7Cata%7Ccontrato%7Cpcaorgao&ordenacao=-data&pagina=1&tam_pagina=10`;
    console.log(`Testing URL: ${url}`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log(`Status: ${response.status}`);
        const data = await response.json();
        console.log(`Results found (items.length): ${data.items ? data.items.length : 'items not found'}`);
        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            const detailUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${item.orgao_cnpj}/compras/${item.ano}/${item.numero_sequencial}/itens`;
            console.log(`Testing Details URL: ${detailUrl}`);
            const detailRes = await fetch(detailUrl);
            const items = await detailRes.json();
            console.log(`Items found: ${items.length}`);
            if (items.length > 0) {
                console.log('First sub-item description:', items[0].descricao.substring(0, 50));
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
};

testPNCP();
