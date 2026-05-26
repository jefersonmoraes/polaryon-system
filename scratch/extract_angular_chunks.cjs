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
files.forEach(f => {
    if (f.endsWith('.har')) {
        try {
            const har = JSON.parse(fs.readFileSync(f, 'utf8'));
            const entries = har.log.entries || [];
            entries.forEach(e => {
                const url = e.request.url;
                const text = e.response.content?.text || '';
                if (text.includes('obterMelhoresValoresPorFornecedor') || text.includes('melhores-valores') || text.includes('por-participante')) {
                    console.log(`\n=== FOUND IN HAR FILE ${path.basename(f)} URL: ${url} ===`);
                    // Find methods
                    const idx = text.indexOf('obterMelhoresValoresPorFornecedor');
                    if (idx !== -1) {
                        console.log("Method Context:");
                        console.log(text.substring(Math.max(0, idx - 200), Math.min(text.length, idx + 400)));
                    }
                    const idx2 = text.indexOf('app-melhores-valores');
                    if (idx2 !== -1) {
                        console.log("Component Selector Context:");
                        console.log(text.substring(Math.max(0, idx2 - 100), Math.min(text.length, idx2 + 300)));
                    }
                }
            });
        } catch (err) {}
    }
});
