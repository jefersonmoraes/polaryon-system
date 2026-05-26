const fs = require('fs');
const path = require('path');

const dir = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walk(dir);
const uniqueUrls = new Set();

files.forEach(f => {
    if (f.endsWith('.har') || f.includes('cnetmobile.estaleiro.serpro') || f.includes('sigapregao')) {
        try {
            const har = JSON.parse(fs.readFileSync(f, 'utf8'));
            const entries = (har.log && har.log.entries) || [];
            entries.forEach(e => {
                const url = e.request.url;
                if (url.includes('serpro.gov.br') || url.includes('comprasnet')) {
                    // Normalize by removing query parameters
                    const cleanUrl = url.split('?')[0];
                    uniqueUrls.add(`${e.request.method} ${cleanUrl}`);
                }
            });
        } catch (err) {}
    }
});

console.log("=== UNIQUE SERPRO/COMPRASNET URLS ===");
Array.from(uniqueUrls).forEach(u => console.log(u));
