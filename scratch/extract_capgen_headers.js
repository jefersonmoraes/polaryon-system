import fs from 'fs';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\disputas.sigapregao.com.br.har';

function extractCapgenHeaders() {
    if (!fs.existsSync(harPath)) {
        console.error('❌ Arquivo HAR não encontrado!');
        return;
    }

    const harData = JSON.parse(fs.readFileSync(harPath, 'utf8'));
    const entries = harData.log.entries;

    entries.forEach((entry, idx) => {
        const req = entry.request;
        const url = req.url;

        if (url.includes('capgen.sigapregao.com.br')) {
            console.log(`\n==================================================`);
            console.log(`[CHAMADA ${idx + 1}] ${req.method} ${url}`);
            console.log('--- TODOS OS CABEÇALHOS DA REQUISIÇÃO ---');
            req.headers.forEach(h => {
                console.log(`  ${h.name}: ${h.value}`);
            });
        }
    });
}

extractCapgenHeaders();
