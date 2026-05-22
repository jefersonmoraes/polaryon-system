const fs = require('fs');
const path = require('path');

const dir = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar';

function getSerproEndpointsFromHar(file) {
    try {
        const har = JSON.parse(fs.readFileSync(file, 'utf8'));
        const entries = (har.log && har.log.entries) || [];
        const set = new Set();
        entries.forEach(e => {
            try {
                const u = new URL(e.request.url);
                if (u.host.includes('serpro.gov.br')) {
                    set.add(`${e.request.method} ${u.pathname}`);
                }
            } catch(err) {}
        });
        return Array.from(set);
    } catch(err) {
        return [];
    }
}

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
const allEndpoints = new Set();
files.forEach(f => {
    if (f.endsWith('.har') || f.includes('cnetmobile.estaleiro.serpro')) {
        console.log(`Analyzing file: ${f}`);
        const eps = getSerproEndpointsFromHar(f);
        eps.forEach(ep => allEndpoints.add(ep));
    }
});

console.log("\n=== ALL DETECTED SERPRO ENDPOINTS ===");
console.log(Array.from(allEndpoints).sort().join('\n'));
