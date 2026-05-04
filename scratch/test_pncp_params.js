import axios from 'axios';

async function checkBll() {
    try {
        console.log('Testing without idSistemaOrigem');
        const res3 = await axios.get('https://pncp.gov.br/api/search/?pagina=1&tam_pagina=5&tipos_documento=edital&status=recebendo_proposta', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('Total without idSistemaOrigem:', res3.data.total);
    } catch (e) {
        console.error('Error no param:', e.response?.data || e.message);
    }
}

checkBll();
