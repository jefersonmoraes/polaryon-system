const axios = require('axios');

async function check() {
    try {
        const res = await axios.get('https://pncp.gov.br/api/search/?q=prefeitura&tipos_documento=edital&pagina=1&tam_pagina=50', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const items = res.data.items || [];
        console.log(`Checked ${items.length} items:`);
        let hasEncerramento = 0;
        let hasVigencia = 0;
        let hasAssinatura = 0;
        let hasPublicacao = 0;
        
        items.forEach((item, idx) => {
            if (item.data_encerramento_proposta) hasEncerramento++;
            if (item.data_fim_vigencia) hasVigencia++;
            if (item.data_assinatura) hasAssinatura++;
            if (item.data_publicacao_pncp) hasPublicacao++;
            
            if (idx < 5) {
                console.log(`Item ${idx + 1}:`);
                console.log(`  title: ${item.title?.substring(0, 50)}`);
                console.log(`  data_publicacao_pncp: ${item.data_publicacao_pncp}`);
                console.log(`  data_inicio_vigencia: ${item.data_inicio_vigencia}`);
                console.log(`  data_fim_vigencia: ${item.data_fim_vigencia}`);
                console.log(`  data_encerramento_proposta: ${item.data_encerramento_proposta}`);
            }
        });
        
        console.log(`\nStats:`);
        console.log(`  data_publicacao_pncp: ${hasPublicacao}/${items.length}`);
        console.log(`  data_encerramento_proposta: ${hasEncerramento}/${items.length}`);
        console.log(`  data_fim_vigencia: ${hasVigencia}/${items.length}`);
        console.log(`  data_assinatura: ${hasAssinatura}/${items.length}`);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

check();
