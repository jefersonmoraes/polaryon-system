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
    if (f.endsWith('.har') || f.includes('cnetmobile.estaleiro.serpro') || f.includes('sigapregao')) {
        try {
            const har = JSON.parse(fs.readFileSync(f, 'utf8'));
            const entries = (har.log && har.log.entries) || [];
            entries.forEach(e => {
                const url = e.request.url;
                if (url.includes('/lances/por-participante')) {
                    console.log(`\n=========================================`);
                    console.log(`File: ${path.basename(f)}`);
                    console.log(`${e.request.method} ${url} -> Status ${e.response.status}`);
                    if (e.response.content && e.response.content.text) {
                        console.log("Response content:");
                        console.log(e.response.content.text);
                    } else {
                        console.log("No response content");
                    }
                }
            });
        } catch (err) {}
    }
});
