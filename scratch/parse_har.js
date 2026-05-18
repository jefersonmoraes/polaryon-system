import fs from 'fs';
import path from 'path';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\www.comprasnet.gov.br.har';

if (!fs.existsSync(harPath)) {
    console.error("Arquivo HAR não encontrado:", harPath);
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(harPath, 'utf-8'));
const entries = data.log.entries;

console.log(`Total de entradas no HAR: ${entries.length}`);

// Filtra requisições relevantes
const relevant = entries.filter(e => {
    const url = e.request.url;
    return url.includes('login') || url.includes('openid') || url.includes('sso') || url.includes('auth') || url.includes('@@');
});

console.log(`\nRelevantes encontradas: ${relevant.length}`);
relevant.forEach((e, idx) => {
    console.log(`\n[${idx + 1}] ${e.request.method} - ${e.request.url}`);
    console.log(`Status: ${e.response.status} ${e.response.statusText}`);
    
    // Mostra referer
    const referer = e.request.headers.find(h => h.name.toLowerCase() === 'referer');
    if (referer) {
        console.log(`Referer: ${referer.value}`);
    }
    
    // Mostra redirectURL
    if (e.response.redirectURL) {
        console.log(`Redirect URL: ${e.response.redirectURL}`);
    }
});
