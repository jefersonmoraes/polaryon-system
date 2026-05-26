const fs = require('fs');
const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\cnetmobile.estaleiro.serpro.gov.br.har';
const har = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = har.log.entries || [];
console.log(`Total entries: ${entries.length}`);
entries.forEach(e => {
    const url = e.request.url;
    if (url.includes('.js')) {
        console.log(`URL: ${url} | Text length: ${e.response.content?.text?.length || 0}`);
    }
});
