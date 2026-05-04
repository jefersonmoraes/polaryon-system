const fs = require('fs');
const path = require('path');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.js')) {
            const content = fs.readFileSync(file, 'utf8');
            const matches = content.match(/https?:\/\/[^\s\"\'\`\)]+/g);
            if (matches) {
                results = results.concat(matches);
            }
        }
    });
    return results;
}
const urls = walk('e:/POLARYON SYSTEM/POLARYON KUNBUN/polaryon-system/importar/siga-client/app_extracted/.webpack');
console.log([...new Set(urls)].join('\n'));
