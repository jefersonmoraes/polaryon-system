const axios = require('axios');

async function verifyAutoupdate() {
    console.log('=== Verificando Servidor de Atualização Automática Polaryon ===\n');

    try {
        const response = await axios.get('https://polaryon.com.br/download/latest.yml', { timeout: 8000 });
        const ymlContent = response.data;
        
        console.log('Conteúdo do latest.yml servido na VPS:');
        console.log(ymlContent);
        
        if (ymlContent.includes('version: 3.8.60')) {
            console.log('✅ SUCESSO: Versão 3.8.60 está ativa para o Auto-Update de todos os robôs!');
        } else {
            console.log('⚠️ AVISO: A versão no latest.yml não corresponde à 3.8.60.');
        }
    } catch (e) {
        console.error('❌ Erro ao baixar o latest.yml:', e.message);
    }
}

verifyAutoupdate();
