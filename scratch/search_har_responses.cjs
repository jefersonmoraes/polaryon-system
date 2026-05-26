const fs = require('fs');

const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\cnetmobile.estaleiro.serpro2.gov.br';
if (!fs.existsSync(file)) {
    console.log("File not found");
    process.exit(1);
}

const har = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = har.log.entries || [];

console.log("=== SEARCH HAR RESPONSES ===");
entries.forEach(e => {
    const url = e.request.url;
    let found = false;
    let foundKw = '';
    const responseText = (e.response.content && e.response.content.text) || '';
    
    // Check url
    if (url.includes('melhores') || url.includes('valores') || url.includes('fornecedor')) {
        found = true;
        foundKw = 'URL matching keyword';
    }
    
    // Check response body
    const keywords = ['melhoresValores', 'melhores-valores', 'melhores_valores', 'melhoresvalores', 'melhores lances'];
    keywords.forEach(kw => {
        if (responseText.includes(kw)) {
            found = true;
            foundKw = `Response body containing "${kw}"`;
        }
    });
    
    if (found) {
        console.log(`[${e.request.method}] ${url} -> Status ${e.response.status} (${foundKw})`);
        console.log(`  Response (first 600 chars): ${responseText.substring(0, 600)}`);
        console.log("-----------------------------------------");
    }
});
