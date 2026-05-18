import fs from 'fs';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\disputas.sigapregao.com.br.har';

function parsePostCalls() {
    console.log('🔍 Buscando chamadas de Envio (POST/PUT) no HAR...');
    
    if (!fs.existsSync(harPath)) {
        console.error('❌ Arquivo HAR não encontrado!');
        return;
    }

    const harData = JSON.parse(fs.readFileSync(harPath, 'utf8'));
    const entries = harData.log.entries;

    const postCalls = [];

    entries.forEach(entry => {
        const req = entry.request;
        const resp = entry.response;
        const url = req.url;

        if (req.method === 'POST' || req.method === 'PUT') {
            postCalls.push({
                method: req.method,
                url: url,
                requestHeaders: req.headers.map(h => `${h.name}: ${h.value}`),
                requestBody: req.postData ? req.postData.text : null,
                status: resp.status,
                responseBody: resp.content && resp.content.text ? resp.content.text.substring(0, 1000) : '(sem resposta)'
            });
        }
    });

    console.log(`📊 Encontradas ${postCalls.length} chamadas de escrita.`);
    
    postCalls.forEach((call, idx) => {
        console.log(`\n--------------------------------------------------`);
        console.log(`[ESCRITA ${idx + 1}] ${call.method} ${call.url}`);
        console.log(`HTTP STATUS: ${call.status}`);
        console.log(`CABEÇALHOS:`);
        call.requestHeaders.forEach(h => {
            if (h.toLowerCase().startsWith('authorization') || h.toLowerCase().startsWith('cookie') || h.toLowerCase().startsWith('referer') || h.toLowerCase().startsWith('origin') || h.toLowerCase().startsWith('content-type')) {
                console.log(`  -> ${h}`);
            }
        });
        if (call.requestBody) {
            console.log(`CORPO DA REQUISIÇÃO:`);
            console.log(call.requestBody);
        }
        console.log(`RESPOSTA (Truncada):`);
        console.log(call.responseBody.substring(0, 500) + '...');
    });
}

parsePostCalls();
