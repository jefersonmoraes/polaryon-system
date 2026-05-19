import fs from 'fs';
import path from 'path';

function findRedirects(harPath) {
    console.log(`\n=== Redirects/Logins in ${path.basename(harPath)} ===`);
    if (!fs.existsSync(harPath)) return;
    const data = JSON.parse(fs.readFileSync(harPath, 'utf8'));
    const entries = data.log.entries;
    
    const results = [];
    for (const entry of entries) {
        const url = entry.request.url;
        const status = entry.response.status;
        const redirect = entry.response.redirectURL;
        
        // Log any redirect or login/sso request
        if (status >= 300 && status < 400 || url.includes('login') || url.includes('sso') || url.includes('authorize') || url.includes('landing')) {
            results.push({
                url,
                status,
                redirect
            });
        }
    }
    
    console.log(`Found ${results.length} entries:`);
    console.log(JSON.stringify(results.slice(0, 50), null, 2));
}

findRedirects('e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\www.comprasnet.gov.br.har');
findRedirects('e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\cnetmobile.estaleiro.serpro.gov.br.har');
