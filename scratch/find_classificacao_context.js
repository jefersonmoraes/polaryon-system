const fs = require('fs');
const content = fs.readFileSync('importar/siga-client/app_extracted/.webpack/main/index.js', 'utf8');

const regex = /classificacao/gi;
let match;
let count = 0;

while ((match = regex.exec(content)) !== null) {
    count++;
    const idx = match.index;
    const start = Math.max(0, idx - 150);
    const end = Math.min(content.length, idx + 150);
    console.log(`\n--- Match #${count} (Index: ${idx}) ---`);
    console.log(content.substring(start, end).replace(/\r?\n/g, ' '));
}
