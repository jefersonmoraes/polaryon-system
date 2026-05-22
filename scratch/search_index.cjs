const fs = require('fs');
const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\siga-client\\app_extracted\\.webpack\\main\\index.js';

if (!fs.existsSync(file)) {
    console.log("File does not exist");
    process.exit(1);
}

const content = fs.readFileSync(file, 'utf8');
console.log(`Loaded file of size ${content.length} characters.`);

function findPattern(pattern) {
    let index = 0;
    let matches = [];
    while (true) {
        const found = content.indexOf(pattern, index);
        if (found === -1) break;
        matches.push(found);
        index = found + pattern.length;
    }
    console.log(`\nMatches for "${pattern}": ${matches.length}`);
    matches.forEach((pos, idx) => {
        console.log(`Match #${idx + 1} at position ${pos}:`);
        console.log(`... ${content.substring(Math.max(0, pos - 150), Math.min(content.length, pos + 150))} ...`);
    });
}

findPattern('meuLance');
findPattern('eMeuLance');
findPattern('eMeu');
findPattern('identificacao');
