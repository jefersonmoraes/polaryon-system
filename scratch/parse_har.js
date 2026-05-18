import fs from 'fs';
import path from 'path';

const harFiles = [
    'e:/POLARYON SYSTEM/POLARYON KUNBUN/polaryon-system/importar/cnetmobile.estaleiro.serpro.gov.br.har',
    'e:/POLARYON SYSTEM/POLARYON KUNBUN/polaryon-system/importar/www.comprasnet.gov.br.har',
    'e:/POLARYON SYSTEM/POLARYON KUNBUN/polaryon-system/importar/disputas.sigapregao.com.br.har'
];

harFiles.forEach(file => {
    if (!fs.existsSync(file)) {
        console.log(`File not found: ${file}`);
        return;
    }
    console.log(`\n======================================================`);
    console.log(`ANALYZING HAR FILE: ${path.basename(file)}`);
    console.log(`======================================================`);

    try {
        const content = JSON.parse(fs.readFileSync(file, 'utf8'));
        const entries = content.log.entries;
        console.log(`Total entries found: ${entries.length}`);

        const summary = [];
        const uniqueUrls = new Set();

        entries.forEach(entry => {
            const req = entry.request;
            const res = entry.response;
            const url = req.url;
            const method = req.method;

            // Keep track of all requests, filter to API / interesting routes
            if (
                url.includes('/api/') || 
                url.includes('/comprasnet-') || 
                url.includes('/compras/') || 
                url.includes('/lances') || 
                url.includes('/disputa') || 
                url.includes('/seguro/')
            ) {
                const urlObj = new URL(url);
                const pathAndQuery = urlObj.pathname + urlObj.search;
                const key = `${method} ${urlObj.origin}${urlObj.pathname}`;

                if (!uniqueUrls.has(key)) {
                    uniqueUrls.add(key);
                    
                    const authHeader = req.headers.find(h => h.name.toLowerCase() === 'authorization');
                    const cookieHeader = req.headers.find(h => h.name.toLowerCase() === 'cookie');
                    
                    const hasAuth = authHeader ? `${authHeader.value.substring(0, 15)}...` : 'None';
                    const hasCookie = cookieHeader ? 'Yes' : 'No';

                    let reqBody = '';
                    if (req.postData && req.postData.text) {
                        reqBody = req.postData.text;
                    }

                    summary.push({
                        method,
                        url,
                        status: res.status,
                        auth: hasAuth,
                        cookie: hasCookie,
                        body: reqBody
                    });
                }
            }
        });

        console.log(`Unique API/Interesting endpoints found: ${summary.length}`);
        summary.slice(0, 50).forEach((item, index) => {
            console.log(`\n[#${index + 1}] ${item.method} ${item.url} -> Status: ${item.status}`);
            console.log(`   - Auth Header: ${item.auth}`);
            console.log(`   - Cookie: ${item.cookie}`);
            if (item.body) {
                console.log(`   - Request Body: ${item.body}`);
            }
        });

    } catch (e) {
        console.error(`Error parsing ${file}:`, e.message);
    }
});
