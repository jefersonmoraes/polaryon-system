const fs = require('fs');

const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\cnetmobile.estaleiro.serpro2.gov.br';
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
        if (u.host.includes('serpro.gov.br')) {
            set.add(`${e.request.method} ${u.pathname}`);
        }
    } catch(err) {}
});

console.log("=== SERPRO ENDPOINTS ===");
console.log(Array.from(set).join('\n'));
