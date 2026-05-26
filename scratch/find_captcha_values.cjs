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
                if (url.includes('captcha=')) {
                    const u = new URL(url);
                    const captcha = u.searchParams.get('captcha');
                    console.log(`\nURL: ${url}`);
                    console.log(`File: ${path.basename(f)}`);
                    console.log(`Captcha: ${captcha ? captcha.substring(0, 50) + '...' : 'null'}`);
                    console.log(`Starts with: ${captcha ? captcha.substring(0, 5) : ''}`);
                }
                // Check headers or body for captcha
                e.request.headers.forEach(h => {
                    if (h.name.toLowerCase().includes('captcha')) {
                        console.log(`Header captcha: ${h.name} = ${h.value}`);
                    }
                });
            });
        } catch (err) {}
    }
});
