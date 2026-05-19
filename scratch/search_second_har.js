import fs from 'fs';
import path from 'path';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\cnetmobile.estaleiro.serpro.gov.br.har';
const data = JSON.parse(fs.readFileSync(harPath, 'utf8'));
const entries = data.log.entries;

const urls = new Set();
for (const entry of entries) {
    const url = entry.request.url;
    if (url.includes('comprasnet.gov.br')) {
        urls.add(url);
    }
}

console.log("All comprasnet.gov.br URLs in cnetmobile.har:");
console.log(JSON.stringify(Array.from(urls), null, 2));
