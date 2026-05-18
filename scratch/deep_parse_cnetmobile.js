import fs from 'fs';

const file = 'e:/POLARYON SYSTEM/POLARYON KUNBUN/polaryon-system/importar/cnetmobile.estaleiro.serpro.gov.br.har';
try {
    const har = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entries = har.log.entries;

    console.log(`Analyzing cnetmobile.estaleiro.serpro.gov.br.har entries...`);
    entries.forEach((e, idx) => {
        const req = e.request;
        const res = e.response;
        
        // Find any entry calling /itens or /lances or with body
        const isApi = req.url.includes('/itens') || req.url.includes('/lances') || req.url.includes('/disputa');
        if (isApi) {
            console.log(`\n------------------------------------------------------------`);
            console.log(`[Entry #${idx}] ${req.method} ${req.url}`);
            console.log(`Status: ${res.status}`);
            console.log(`Headers:`);
            req.headers.forEach(h => {
                if (['authorization', 'cookie', 'user-agent', 'content-type'].includes(h.name.toLowerCase())) {
                    console.log(`  ${h.name}: ${h.value}`);
                }
            });
            if (req.postData) {
                console.log(`Post Data:`, req.postData.text || req.postData);
            }
            if (res.content && res.content.text) {
                try {
                    // Try to parse json and show subset
                    const parsed = JSON.parse(res.content.text);
                    console.log(`Response (first 400 chars):`, JSON.stringify(parsed).substring(0, 400));
                } catch(err) {
                    console.log(`Response Text (first 400 chars):`, res.content.text.substring(0, 400));
                }
            }
        }
    });

} catch(err) {
    console.error(err);
}
