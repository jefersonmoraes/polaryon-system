const axios = require('axios');

async function testLiveSite() {
    console.log('=== Verificando Deploy e Funcionamento da Busca PNCP ===\n');

    // 1. Verificar se o backend está online
    try {
        console.log('1. Testando backend /api/health...');
        const health = await axios.get('https://polaryon.com.br/api/health', { timeout: 8000 });
        console.log('   ✅ Backend online:', JSON.stringify(health.data).substring(0, 200));
    } catch (e) {
        console.log('   ❌ Backend health erro:', e.message);
    }

    // 2. Testar o proxy PNCP do backend
    try {
        console.log('\n2. Testando proxy backend /api/transparency/pncp-proxy...');
        const proxy = await axios.get('https://polaryon.com.br/api/transparency/pncp-proxy', {
            params: { tam_pagina: 5, pagina: 1, status: 'recebendo_proposta', tipos_documento: 'edital' },
            timeout: 10000
        });
        const items = proxy.data?.items || proxy.data || [];
        if (Array.isArray(items) && items.length > 0) {
            console.log(`   ✅ Proxy PNCP retornou ${items.length} itens`);
        } else {
            console.log('   ⚠️ Proxy PNCP retornou vazio ou bloqueado:', JSON.stringify(proxy.data).substring(0, 300));
        }
    } catch (e) {
        console.log('   ❌ Proxy PNCP erro:', e.message);
        if (e.response) console.log('   Status:', e.response.status, '| Body:', String(e.response.data).substring(0, 200));
    }

    // 3. Testar chamada direta ao PNCP (como o browser vai fazer agora)
    try {
        console.log('\n3. Testando chamada DIRETA ao pncp.gov.br/api/search/ (como o browser faz)...');
        const direct = await axios.get('https://pncp.gov.br/api/search/', {
            params: { tam_pagina: 5, pagina: 1, status: 'recebendo_proposta', tipos_documento: 'edital' },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://polaryon.com.br',
                'Referer': 'https://polaryon.com.br/'
            },
            timeout: 10000
        });
        const items = direct.data?.items || [];
        if (items.length > 0) {
            console.log(`   ✅ PNCP Direto retornou ${items.length} itens!`);
            console.log('   Exemplo:', items[0]?.objeto_compra?.substring(0, 80) || JSON.stringify(items[0]).substring(0, 80));
        } else {
            console.log('   ⚠️ Chamada direta vazia:', JSON.stringify(direct.data).substring(0, 300));
        }
    } catch (e) {
        console.log('   ❌ Chamada direta ao PNCP erro:', e.message);
        if (e.response) {
            console.log('   Status:', e.response.status);
            const body = String(e.response.data || '').substring(0, 300);
            if (body.includes('<html>') || body.includes('TSPD')) {
                console.log('   ⛔ WAF Block ativo para este IP também!');
            } else {
                console.log('   Body:', body);
            }
        }
    }

    // 4. Verificar se o JS do frontend já foi publicado (verificar hash do OportunidadesSearch bundle)
    try {
        console.log('\n4. Verificando se o novo bundle está publicado na web...');
        const html = await axios.get('https://polaryon.com.br/', { timeout: 8000 });
        const content = html.data || '';
        if (content.includes('OportunidadesSearch')) {
            console.log('   ✅ Bundle OportunidadesSearch encontrado no HTML');
        } else {
            // Busca qualquer script tag com assets
            const scriptMatch = content.match(/src="\/assets\/OportunidadesSearch[^"]+"/g);
            if (scriptMatch) {
                console.log('   ✅ Script tag:', scriptMatch[0]);
            } else {
                console.log('   ⚠️ Bundle OportunidadesSearch NÃO encontrado - deploy pendente');
                // Mostrar scripts encontrados
                const allScripts = content.match(/src="\/assets\/[^"]+"/g) || [];
                console.log('   Scripts na página:', allScripts.slice(0, 5).join(', '));
            }
        }
    } catch (e) {
        console.log('   ❌ Erro ao checar HTML:', e.message);
    }

    console.log('\n=== Diagnóstico Concluído ===');
}

testLiveSite();
