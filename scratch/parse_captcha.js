import fs from 'fs';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\disputas.sigapregao.com.br.har';

function parseCaptchaCalls() {
    console.log('🔍 Analisando chamadas de CAPTCHA no HAR...');
    
    if (!fs.existsSync(harPath)) {
        console.error('❌ Arquivo HAR não encontrado!');
        return;
    }

    const harData = JSON.parse(fs.readFileSync(harPath, 'utf8'));
    const entries = harData.log.entries;

    entries.forEach((entry, idx) => {
        const req = entry.request;
        const resp = entry.response;
        const url = req.url;

        if (url.includes('captcha') || url.includes('capgen')) {
            console.log(`\n==================================================`);
            console.log(`[CAPTCHA CALL] ${req.method} ${url}`);
            console.log(`Status HTTP: ${resp.status}`);
            if (req.postData && req.postData.text) {
                console.log(`Corpo enviado:`, req.postData.text);
            }
            if (resp.content && resp.content.text) {
                console.log(`Resposta:`, resp.content.text.substring(0, 1000));
            }
        }
    });
}

parseCaptchaCalls();
