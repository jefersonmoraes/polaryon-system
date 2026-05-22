const fs = require('fs');
const path = require('path');

const dir = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar';

function getLancesUrls(file) {
    try {
        const har = JSON.parse(fs.readFileSync(file, 'utf8'));
        const entries = (har.log && har.log.entries) || [];
        const results = [];
        entries.forEach(e => {
            const url = e.request.url;
            if (url.toLowerCase().includes('lance') || url.toLowerCase().includes('rank') || url.toLowerCase().includes('classific')) {
                results.push({
                    file: path.basename(file),
                    method: e.request.method,
                    url: url,
                    status: e.response.status
                });
            }
        });
        return results;
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
const allMatches = [];
files.forEach(f => {
    if (f.endsWith('.har') || f.includes('cnetmobile.estaleiro.serpro') || f.includes('sigapregao')) {
        const matches = getLancesUrls(f);
        allMatches.push(...matches);
    }
});

console.log(`=== MATCHED LANCES/RANKING/CLASSIFICACAO URLS (${allMatches.length}) ===`);
allMatches.forEach(m => {
    console.log(`[${m.file}] ${m.method} ${m.url} -> ${m.status}`);
});
