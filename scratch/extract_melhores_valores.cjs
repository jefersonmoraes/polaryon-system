const fs = require('fs');

const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\cnetmobile.estaleiro.serpro2.gov.br';
if (!fs.existsSync(file)) {
    console.log("File not found");
    process.exit(1);
}

const har = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = har.log.entries || [];

entries.forEach(e => {
    const text = (e.response.content && e.response.content.text) || '';
    let idx = text.indexOf('melhores-valores');
    if (idx !== -1) {
        console.log(`Found "melhores-valores" in entry: ${e.request.url}`);
        while (idx !== -1) {
            const start = Math.max(0, idx - 100);
            const end = Math.min(text.length, idx + 200);
            console.log(`Context: ${text.substring(start, end)}`);
            idx = text.indexOf('melhores-valores', idx + 1);
        }
    }
});
