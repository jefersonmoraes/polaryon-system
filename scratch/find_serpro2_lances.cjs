const fs = require('fs');
const path = require('path');

const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\cnetmobile.estaleiro.serpro2.gov.br';
if (!fs.existsSync(file)) {
    console.log("File does not exist");
    process.exit(1);
}

const har = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = har.log.entries || [];

console.log("=== LANCES REQUESTS IN cnetmobile.estaleiro.serpro2.gov.br ===");
entries.forEach(e => {
    if (e.request.url.includes('lances')) {
        console.log(`${e.request.method} ${e.request.url} -> ${e.response.status}`);
        if (e.response.content && e.response.content.text) {
            console.log(`  Response (first 300 chars): ${e.response.content.text.substring(0, 300)}`);
        }
    }
});
