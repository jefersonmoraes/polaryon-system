import fs from 'fs';

const file = 'e:/POLARYON SYSTEM/POLARYON KUNBUN/polaryon-system/importar/disputas.sigapregao.com.br.har';
try {
    const har = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entries = har.log.entries;

    console.log(`Checking sigapregao entries...`);
    entries.forEach((e, idx) => {
        const req = e.request;
        const res = e.response;
        
        if (req.url.includes('api') || req.url.includes('captcha') || req.url.includes('lance') || req.url.includes('disputa')) {
            console.log(`\n[Entry #${idx}] ${req.method} ${req.url} -> ${res.status}`);
            if (req.postData) {
                console.log(`  Post Data:`, req.postData.text || req.postData);
            }
            if (res.content && res.content.text) {
                console.log(`  Response (first 200 chars):`, res.content.text.substring(0, 200));
            }
        }
    });

} catch(err) {
    console.error(err);
}
