import axios from 'axios';

async function testDatesHyphens() {
    try {
        // Test with hyphens
        const url = 'https://pncp.gov.br/api/search/?pagina=1&tam_pagina=10&tipos_documento=edital&status=recebendo_proposta&data_publicacao_inicial=2026-05-01&data_publicacao_final=2026-05-15';
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('Total with date filter (2026-05-01 to 2026-05-15):', res.data.total);
        if (res.data.items && res.data.items.length > 0) {
            console.log('Sample item date:', res.data.items[0].data_publicacao_pncp);
        }
    } catch (e) {
        console.error('Error detail:', e.response?.data || e.message);
    }
}

testDatesHyphens();
