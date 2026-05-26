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
    if (text.includes('app-melhores-valores')) {
        console.log(`Found app-melhores-valores in: ${e.request.url}`);
        
        // Find component class or definition
        // Let's print out lines/sentences that contain "/compras" or "/itens" or "lances" or URL patterns within the chunk
        const regex = /"https?:\/\/[^"]+"|'https?:\/\/[^']+'|`https?:\/\/[^`]+`|"\/\w+[^"]+"|'\/\w+[^']+'|`\/\w+[^`]+`/g;
        let match;
        const searchRangeStart = text.indexOf('app-melhores-valores') - 10000;
        const searchRangeEnd = text.indexOf('app-melhores-valores') + 10000;
        const sub = text.substring(Math.max(0, searchRangeStart), Math.min(text.length, searchRangeEnd));
        
        console.log("=== MATCHED PATHS/URLS AROUND app-melhores-valores ===");
        while ((match = regex.exec(sub)) !== null) {
            console.log(match[0]);
        }
    }
});
