import fs from 'fs';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\disputas.sigapregao.com.br.har';

function parseLocalhostCalls() {
    console.log('🔍 Buscando chamadas ao Localhost no HAR...');
    
    if (!fs.existsSync(harPath)) {
        console.error('❌ Arquivo HAR não encontrado!');
        return;
    }

    const harData = JSON.parse(fs.readFileSync(harPath, 'utf8'));
    const entries = harData.log.entries;

    const localhostCalls = [];

    entries.forEach(entry => {
        const req = entry.request;
        const resp = entry.response;
        const url = req.url;

        if (url.includes('localhost') || url.includes('127.0.0.1')) {
            localhostCalls.push({
                method: req.method,
                url: url,
                requestHeaders: req.headers.map(h => `${h.name}: ${h.value}`),
                requestBody: req.postData ? req.postData.text : null,
                status: resp.status,
                responseBody: resp.content && resp.content.text ? resp.content.text.substring(0, 1000) : '(sem resposta)'
            });
        }
    });

    console.log(`📊 Encontradas ${localhostCalls.length} chamadas ao Localhost.`);
    
    localhostCalls.forEach((call, idx) => {
        console.log(`\n--------------------------------------------------`);
        console.log(`[CHAMADA ${idx + 1}] ${call.method} ${call.url}`);
        console.log(`HTTP STATUS: ${call.status}`);
        console.log(`CABEÇALHOS DE REQUISIÇÃO:`);
        call.requestHeaders.forEach(h => {
            if (h.toLowerCase().startsWith('authorization') || h.toLowerCase().startsWith('cookie') || h.toLowerCase().startsWith('referer') || h.toLowerCase().startsWith('origin')) {
                console.log(`  -> ${h}`);
            }
        });
        if (call.requestBody) {
            console.log(`CORPO DA REQUISIÇÃO:`);
            console.log(call.requestBody);
        }
        console.log(`EXEMPLO DE RESPOSTA (Truncada):`);
        console.log(call.responseBody.substring(0, 500) + '...');
    });
}

parseLocalhostCalls();
