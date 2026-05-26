const fs = require('fs');
const path = require('path');

const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\cnetmobile.estaleiro.serpro2.gov.br';
if (!fs.existsSync(file)) {
    console.log("File does not exist");
    process.exit(1);
}

const har = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = har.log.entries || [];

console.log("=== ALL COMPRAS DISPUTA REQUESTS ===");
entries.forEach(e => {
    const url = e.request.url;
    if (url.includes('comprasnet-disputa/v1/compras')) {
        console.log(`${e.request.method} ${url} -> ${e.response.status}`);
        if (e.response.content && e.response.content.text) {
            console.log(`  Response (first 600 chars): ${e.response.content.text.substring(0, 600)}`);
        }
    }
});
