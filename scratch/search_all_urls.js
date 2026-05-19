import fs from 'fs';
import path from 'path';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\www.comprasnet.gov.br.har';
const data = JSON.parse(fs.readFileSync(harPath, 'utf8'));
const entries = data.log.entries;

const urls = new Set();
for (const entry of entries) {
    const url = entry.request.url;
    if (url.includes('comprasnet.gov.br') && !url.includes('.svg') && !url.includes('.png') && !url.includes('.css') && !url.includes('.js') && !url.includes('.gif') && !url.includes('.woff')) {
        urls.add(url);
    }
}

console.log("All unique non-static comprasnet.gov.br URLs in HAR:");
console.log(JSON.stringify(Array.from(urls), null, 2));
