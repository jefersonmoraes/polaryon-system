const fs = require('fs');
const path = require('path');

const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\siga-client\\app_extracted\\.webpack\\main\\index.js';
if (!fs.existsSync(file)) {
    console.log("File not found");
    process.exit(1);
}

const content = fs.readFileSync(file, 'utf8');
const terms = ['classificacao', 'por-participante', 'melhores-valores', 'melhoresValores', 'melhoresvalores'];

terms.forEach(term => {
    let idx = content.indexOf(term);
    console.log(`\n=== SEARCHING FOR "${term}" IN SIGA CLIENT ===`);
    let count = 0;
    while (idx !== -1 && count < 10) {
        count++;
        const start = Math.max(0, idx - 250);
        const end = Math.min(content.length, idx + 250);
        console.log(`Match #${count} at ${idx}:`);
        console.log(content.substring(start, end).replace(/\r?\n/g, ' '));
        idx = content.indexOf(term, idx + 1);
    }
});
