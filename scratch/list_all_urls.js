import fs from 'fs';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\disputas.sigapregao.com.br.har';

function listAllDistinctUrls() {
    console.log('🔍 Mapeando todas as rotas únicas no HAR...');
    
    if (!fs.existsSync(harPath)) {
        console.error('❌ Arquivo HAR não encontrado!');
        return;
    }

    const harData = JSON.parse(fs.readFileSync(harPath, 'utf8'));
    const entries = harData.log.entries;

    const urls = {};

    entries.forEach(entry => {
        const req = entry.request;
        const method = req.method;
        const rawUrl = req.url;
        
        try {
            const urlObj = new URL(rawUrl);
            const domain = urlObj.hostname;
            const path = urlObj.pathname;
            
            const key = `${method} | ${domain} | ${path}`;
            if (!urls[key]) {
                urls[key] = {
                    method,
                    domain,
                    path,
                    fullUrlSample: rawUrl,
                    count: 0
                };
            }
            urls[key].count++;
        } catch {
            const key = `${method} | RAW | ${rawUrl}`;
            if (!urls[key]) {
                urls[key] = {
                    method,
                    domain: 'RAW',
                    path: rawUrl,
                    fullUrlSample: rawUrl,
                    count: 0
                };
            }
            urls[key].count++;
        }
    });

    console.log(`📊 Encontrados ${Object.keys(urls).length} caminhos únicos.`);
    console.log('--------------------------------------------------------------------------------');
    console.log('MÉTODO | DOMÍNIO | CAMINHO | QTD');
    console.log('--------------------------------------------------------------------------------');
    
    // Agrupa e ordena por domínio
    const sorted = Object.values(urls).sort((a, b) => {
        if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
        return a.path.localeCompare(b.path);
    });

    sorted.forEach(u => {
        console.log(`${u.method.padEnd(6)} | ${u.domain.padEnd(30)} | ${u.path.padEnd(50)} | ${u.count}`);
    });
}

listAllDistinctUrls();
