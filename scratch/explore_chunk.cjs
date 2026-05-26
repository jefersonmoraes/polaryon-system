const fs = require('fs');
const path = require('path');

const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\Disputa\\cnetmobile.estaleiro.serpro.gov.br.har';
const har = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = har.log.entries || [];

entries.forEach(e => {
    const url = e.request.url;
    if (url.includes('chunk-Y3OMQJIQ.js')) {
        const text = e.response.content?.text || '';
        const term = 'obterMelhoresLances';
        let idx = text.indexOf(term);
        console.log(`\n=== SEARCH TERM: "${term}" ===`);
        let count = 0;
        while (idx !== -1 && count < 10) {
            count++;
            console.log(`Match #${count} at position ${idx}:`);
            console.log(text.substring(Math.max(0, idx - 400), Math.min(text.length, idx + 600)));
            idx = text.indexOf(term, idx + 1);
        }
    }
});
