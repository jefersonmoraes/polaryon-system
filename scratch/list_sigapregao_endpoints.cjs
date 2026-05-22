const fs = require('fs');
const path = require('path');

const files = [
    'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\disputas.sigapregao.com.br.har',
    'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\Disputa\\disputas.sigapregao.com.br.har',
    'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\disputas.sigapregao2.com.br'
];

const set = new Set();
files.forEach(file => {
    if (!fs.existsSync(file)) return;
    try {
        const har = JSON.parse(fs.readFileSync(file, 'utf8'));
        const entries = har.log.entries || [];
        entries.forEach(e => {
            try {
                const u = new URL(e.request.url);
                set.add(`${e.request.method} ${u.host}${u.pathname}`);
            } catch(err) {}
        });
    } catch(err) {}
});

console.log("=== DISTINCT SIGAPREGAO HAR ENDPOINTS ===");
console.log(Array.from(set).sort().join('\n'));
