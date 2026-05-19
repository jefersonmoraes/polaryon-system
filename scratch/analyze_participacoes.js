import fs from 'fs';
import path from 'path';

function searchParticipacoes(harPath) {
    console.log(`\n=== Analyzing ${path.basename(harPath)} ===`);
    if (!fs.existsSync(harPath)) {
        console.log("File does not exist!");
        return;
    }
    const data = JSON.parse(fs.readFileSync(harPath, 'utf8'));
    const entries = data.log.entries;
    
    let count = 0;
    for (const entry of entries) {
        if (entry.request.url.includes('/participacoes')) {
            console.log('--- FOUND PARTICIPACOES ---');
            console.log('URL:', entry.request.url);
            console.log('Method:', entry.request.method);
            console.log('Status:', entry.response.status);
            
            if (entry.response.content && entry.response.content.text) {
                try {
                    const parsedData = JSON.parse(entry.response.content.text);
                    console.log('Data Length:', Array.isArray(parsedData) ? parsedData.length : 'Not an array');
                    if (Array.isArray(parsedData) && parsedData.length > 0) {
                        console.log('First Item Sample:', JSON.stringify(parsedData[0], null, 2));
                    }
                } catch (e) {
                    console.log('Response content is not valid JSON or empty.');
                }
            }
            console.log('------------------------\n');
            count++;
        }
    }
    console.log(`Total /participacoes found: ${count}`);
}

searchParticipacoes('e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\cnetmobile.estaleiro.serpro.gov.br.har');
searchParticipacoes('e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\www.comprasnet.gov.br.har');
