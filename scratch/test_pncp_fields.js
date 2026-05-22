import axios from 'axios';

async function logFields() {
    try {
        const url = 'https://pncp.gov.br/api/search/?pagina=1&tam_pagina=10&tipos_documento=edital&status=recebendo_proposta';
        const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const items = res.data.items || [];
        if (items.length > 0) {
            console.log('Available keys in first item:', Object.keys(items[0]));
            console.log('Sample item values for date fields:');
            items.slice(0, 3).forEach((item, idx) => {
                console.log(`\nItem ${idx + 1}:`);
                console.log('  title:', item.title);
                console.log('  data_publicacao_pncp:', item.data_publicacao_pncp);
                console.log('  data_atualizacao_pncp:', item.data_atualizacao_pncp);
                console.log('  data_encerramento_proposta:', item.data_encerramento_proposta);
                console.log('  data_fim_vigencia:', item.data_fim_vigencia);
                console.log('  data_inicio_vigencia:', item.data_inicio_vigencia);
                console.log('  data_inicio_proposta:', item.data_inicio_proposta);
                console.log('  situacao_nome:', item.situacao_nome);
            });
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

logFields();
