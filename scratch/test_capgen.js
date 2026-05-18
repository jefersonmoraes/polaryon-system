import axios from 'axios';

async function testCapgen() {
    console.log('📡 [TESTE] Tentando buscar Token de Captcha da nuvem do Siga...');
    
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'pt-BR',
        'origin': 'https://disputas.sigapregao.com.br',
        'referer': 'https://disputas.sigapregao.com.br/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SIGAClient/0.7.2 Chrome/112.0.5615.165 Electron/24.1.3 Safari/537.36'
    };

    try {
        console.log('1. Chamando /capgen/captcha-dispensas...');
        const res1 = await axios.get('https://capgen.sigapregao.com.br/capgen/captcha-dispensas', { headers });
        console.log('✅ Resposta 1 recebida!');
        console.log('Token 1:', res1.data.substring(0, 100) + '...');
        console.log('Tamanho do Token:', res1.data.length);
    } catch (e) {
        console.error('❌ Falha na Chamada 1:', e.message);
    }

    try {
        console.log('\n2. Chamando /capgen/captcha-dispensas-2...');
        const res2 = await axios.get('https://capgen.sigapregao.com.br/capgen/captcha-dispensas-2', { headers });
        console.log('✅ Resposta 2 recebida!');
        console.log('Token 2:', res2.data.substring(0, 100) + '...');
        console.log('Tamanho do Token:', res2.data.length);
    } catch (e) {
        console.error('❌ Falha na Chamada 2:', e.message);
    }
}

testCapgen();
