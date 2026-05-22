const fs = require('fs');
const path = require('path');

const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\www.comprasnet.gov.br.har';
if (!fs.existsSync(file)) {
    console.log("File does not exist.");
    process.exit(1);
}

const har = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = har.log.entries || [];

const set = new Set();
entries.forEach(e => {
    try {
        const u = new URL(e.request.url);
        set.add(`${e.request.method} ${u.host}${u.pathname}`);
    } catch(err) {}
});

console.log("=== ALL ENDPOINTS IN www.comprasnet.gov.br.har ===");
console.log(Array.from(set).sort().join('\n'));
