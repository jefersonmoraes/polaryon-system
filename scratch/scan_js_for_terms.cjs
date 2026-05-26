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
    if (e.request.url.includes('chunk-Y3OMQJIQ.js')) {
        const terms = ['por-participante', 'lances/por-participante', 'melhores-valores', 'participante'];
        terms.forEach(term => {
            let idx = text.indexOf(term);
            console.log(`\n=== SEARCHING FOR "${term}" ===`);
            while (idx !== -1) {
                const start = Math.max(0, idx - 150);
                const end = Math.min(text.length, idx + 150);
                console.log(`Match at ${idx}: ${text.substring(start, end).replace(/\r?\n/g, ' ')}`);
                idx = text.indexOf(term, idx + 1);
            }
        });
    }
});
