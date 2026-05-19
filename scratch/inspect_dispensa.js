import fs from 'fs';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\www.comprasnet.gov.br.har';
const data = JSON.parse(fs.readFileSync(harPath, 'utf8'));
const entries = data.log.entries;

for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const url = entry.request.url;
    if (url.includes('dispensa_eletronica.asp')) {
        console.log(`\n=== Found dispensa_eletronica.asp at index ${i} ===`);
        console.log("Request Method:", entry.request.method);
        console.log("Response Status:", entry.response.status);
        console.log("Redirect URL:", entry.response.redirectURL);
        console.log("Response Content Type:", entry.response.content.mimeType);
        
        // Print response headers
        console.log("Response Headers:");
        console.log(JSON.stringify(entry.response.headers, null, 2));
        
        // Print surrounding requests (2 before, 2 after)
        console.log("\nSurrounding Requests:");
        for (let j = Math.max(0, i - 2); j <= Math.min(entries.length - 1, i + 2); j++) {
            console.log(`[${j}] ${entries[j].request.method} ${entries[j].request.url} -> Status ${entries[j].response.status}`);
        }
    }
}
