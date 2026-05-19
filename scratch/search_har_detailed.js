import fs from 'fs';
import path from 'path';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\www.comprasnet.gov.br.har';
const data = JSON.parse(fs.readFileSync(harPath, 'utf8'));
const entries = data.log.entries;

const results = [];
for (const entry of entries) {
    const url = entry.request.url;
    const status = entry.response.status;
    const redirect = entry.response.redirectURL;
    
    // Check if the request is an ASP page or relates to navigation/links
    if (url.includes('.asp') || url.includes('.htm') || url.includes('.html')) {
        results.push({
            url,
            status,
            method: entry.request.method,
            redirect
        });
    }
}

console.log(`Found ${results.length} ASP/HTM entries in www.comprasnet.gov.br.har:`);
console.log(JSON.stringify(results, null, 2));
