import fs from 'fs';

const file = 'e:/POLARYON SYSTEM/POLARYON KUNBUN/polaryon-system/importar/cnetmobile.estaleiro.serpro.gov.br.har';
try {
    const har = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entries = har.log.entries;

    console.log(`Dumping all URLs in cnetmobile HAR:`);
    entries.forEach((e, idx) => {
        console.log(`[#${idx}] ${e.request.method} ${e.request.url} -> Status: ${e.response.status}`);
    });

} catch(err) {
    console.error(err);
}
