import fs from 'fs';

const file = 'e:/POLARYON SYSTEM/POLARYON KUNBUN/polaryon-system/importar/cnetmobile.estaleiro.serpro.gov.br.har';
try {
    const har = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entries = har.log.entries;

    console.log(`Checking cookies and authorization headers in all cnetmobile entries...`);
    
    entries.forEach((e, idx) => {
        const req = e.request;
        const res = e.response;
        
        const auth = req.headers.find(h => h.name.toLowerCase() === 'authorization');
        const cookie = req.headers.find(h => h.name.toLowerCase() === 'cookie');
        
        if (auth || cookie || req.url.includes('login') || req.url.includes('token')) {
            console.log(`\n[Entry #${idx}] ${req.method} ${req.url} -> ${res.status}`);
            if (auth) console.log(`  Authorization: ${auth.value.substring(0, 40)}...`);
            if (cookie) console.log(`  Cookie: ${cookie.value}`);
        }
    });

} catch(err) {
    console.error(err);
}
