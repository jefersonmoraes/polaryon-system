const axios = require('axios');

async function checkDeploy() {
    console.log('=== Verificando Deploy do Novo Robô de Lances ===\n');

    // 1. Verificar qual main.js o index.html está carregando
    try {
        const html = await axios.get('https://polaryon.com.br/', { timeout: 8000 });
        const content = html.data || '';
        
        const mainMatch = content.match(/src="\/assets\/(main-[^"]+)"/g);
        
        if (content.includes('main-oup4HE_s.js')) {
            console.log('✅ index.html já serve o novo bundle do robô (main-oup4HE_s.js)');
        } else {
            console.log('⚠️ index.html ainda não aponta para o novo bundle. Scripts na página:', mainMatch);
        }
        
    } catch (e) {
        console.error('Erro ao checar index.html:', e.message);
    }

    // 2. Verificar se o novo BiddingDashboardPage chunk está acessível
    const newChunk = 'BiddingDashboardPage-DSeS7FDy.js';
    try {
        const chunk = await axios.get(`https://polaryon.com.br/assets/${newChunk}`, { timeout: 8000 });
        if (chunk.status === 200) {
            console.log(`✅ Novo chunk do painel de lances ${newChunk} está ONLINE (${chunk.data.length} bytes)`);
        }
    } catch (e) {
        console.log(`❌ Novo chunk ${newChunk} NÃO acessível: ${e.message}`);
    }
}

checkDeploy();
