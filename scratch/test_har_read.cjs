const fs = require('fs');
const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\cnetmobile.estaleiro.serpro.gov.br.har';
const har = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = har.log.entries || [];
entries.forEach(e => {
    if (e.request.url.includes('chunk-Y3OMQJIQ.js')) {
        console.log("Found entry!");
        const text = e.response.content?.text || '';
        console.log(`Length: ${text.length}`);
        console.log(`First 500 chars: ${text.substring(0, 500)}`);
    }
});
