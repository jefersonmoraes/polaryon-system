const axios = require('axios');
const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const expectedVersion = pkg.version;

async function verifyAutoupdate() {
    console.log(`=== Verificando Servidor de Atualização Automática Polaryon (v${expectedVersion}) ===\n`);

    try {
        const response = await axios.get('https://polaryon.com.br/download/latest.yml', { timeout: 8000 });
        const ymlContent = response.data;
        
        console.log('Conteúdo do latest.yml servido na VPS:');
        console.log(ymlContent);
        
        if (ymlContent.includes(`version: ${expectedVersion}`)) {
            console.log(`✅ SUCESSO: Versão ${expectedVersion} está ativa para o Auto-Update de todos os robôs!`);
        } else {
            const versionMatch = ymlContent.match(/version:\s*(\S+)/);
            const liveVersion = versionMatch ? versionMatch[1] : 'desconhecida';
            console.log(`⚠️ AVISO: latest.yml aponta para v${liveVersion}, mas o local é v${expectedVersion}.`);
        }
    } catch (e) {
        console.error('❌ Erro ao baixar o latest.yml:', e.message);
    }
}

verifyAutoupdate();
