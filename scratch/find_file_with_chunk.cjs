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
    try {
        const content = fs.readFileSync(f, 'utf8');
        if (content.includes('chunk-Y3OMQJIQ.js')) {
            console.log(`Found in file: ${f}`);
        }
    } catch(e) {}
});
