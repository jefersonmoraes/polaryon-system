const axios = require('axios');

async function test() {
    try {
        const headers = {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'pt-BR',
            'origin': 'https://disputas.sigapregao.com.br',
            'referer': 'https://disputas.sigapregao.com.br/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SIGAClient/0.7.2 Chrome/112.0.5615.165 Electron/24.1.3 Safari/537.36'
        };
        const res = await axios.get('https://capgen.sigapregao.com.br/capgen/captcha-dispensas', { headers, timeout: 5000 });
        console.log('capgen response type:', typeof res.data);
        console.log('capgen response sample:', String(res.data).substring(0, 100));
    } catch (e) {
        console.error('capgen failed:', e.message);
    }

    try {
        const fallbackRes = await axios.get('https://polaryon.com.br/api/bidding/captcha-pool', { timeout: 4000 });
        console.log('fallback response:', fallbackRes.data);
    } catch (err) {
        console.error('fallback failed:', err.message);
    }
}

test();
