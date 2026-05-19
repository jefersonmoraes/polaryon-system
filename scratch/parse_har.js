import fs from 'fs';
import path from 'path';

function analyzeHar(filePath) {
    console.log(`\n=== Analyzing ${path.basename(filePath)} ===`);
    if (!fs.existsSync(filePath)) {
        console.log("File does not exist!");
        return;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const entries = data.log.entries;
    const urls = entries.map(e => e.request.url);
    const uniqueHosts = new Set();
    const uniquePaths = new Set();
    
    for (const url of urls) {
        try {
            const parsed = new URL(url);
            uniqueHosts.add(parsed.hostname);
            uniquePaths.add(parsed.pathname);
        } catch (e) {
            // Ignore invalid URLs
        }
    }
    
    console.log("Unique Hostnames:");
    console.log(Array.from(uniqueHosts));
    
    console.log("\nSome sample URLs (first 30):");
    console.log(urls.slice(0, 30));
}

analyzeHar('e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\www.comprasnet.gov.br.har');
analyzeHar('e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\cnetmobile.estaleiro.serpro.gov.br.har');
