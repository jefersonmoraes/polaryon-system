import fs from 'fs';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\www.comprasnet.gov.br.har';
const data = JSON.parse(fs.readFileSync(harPath, 'utf8'));
const entries = data.log.entries;

for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const url = entry.request.url;
    if (url.includes('dispensa_eletronica.asp')) {
        console.log(`=== HTML Body of dispensa_eletronica.asp at index ${i} ===`);
        console.log(entry.response.content.text);
    }
}
