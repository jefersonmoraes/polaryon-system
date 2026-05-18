import fs from 'fs';
import path from 'path';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\disputas.sigapregao.com.br.har';

function parseHar() {
    console.log('🔍 Iniciando análise do arquivo HAR...');
    
    if (!fs.existsSync(harPath)) {
        console.error('❌ Arquivo HAR não encontrado!');
        return;
    }

    const harData = JSON.parse(fs.readFileSync(harPath, 'utf8'));
    const entries = harData.log.entries;
    console.log(`📊 Total de requisições gravadas no HAR: ${entries.length}\n`);

    const endpoints = {};

    entries.forEach(entry => {
        const req = entry.request;
        const resp = entry.response;
        const url = req.url;
        const method = req.method;
        const status = resp.status;

        // Foca em APIs interessantes (Serpro, Comprasnet, Siga, etc.)
        if (url.includes('compras') || url.includes('serpro') || url.includes('disputa') || url.includes('lance')) {
            const urlObj = new URL(url);
            const pathKey = `${method} ${urlObj.origin}${urlObj.pathname}`;

            if (!endpoints[pathKey]) {
                endpoints[pathKey] = {
                    method,
                    url: url.split('?')[0],
                    count: 0,
                    statusCodes: new Set(),
                    sampleParams: urlObj.search,
                    sampleRequestBody: null,
                    sampleResponseBodySize: resp.content.size,
                    sampleResponseText: null
                };
            }

            endpoints[pathKey].count++;
            endpoints[pathKey].statusCodes.add(status);

            // Tenta pegar um exemplo de corpo de requisição
            if (req.postData && req.postData.text) {
                try {
                    endpoints[pathKey].sampleRequestBody = JSON.parse(req.postData.text);
                } catch {
                    endpoints[pathKey].sampleRequestBody = req.postData.text;
                }
            }

            // Tenta pegar um exemplo de resposta de API
            if (resp.content && resp.content.text && !endpoints[pathKey].sampleResponseText) {
                try {
                    const parsed = JSON.parse(resp.content.text);
                    // Minimiza para não poluir muito a saída
                    endpoints[pathKey].sampleResponseText = Array.isArray(parsed) ? parsed.slice(0, 1) : parsed;
                } catch {
                    endpoints[pathKey].sampleResponseText = resp.content.text.substring(0, 200) + '...';
                }
            }
        }
    });

    console.log('📝 --- ENDPOINTS DE INTERESSE ENCONTRADOS ---');
    Object.values(endpoints).forEach((ep, i) => {
        console.log(`\n[${i+1}] ${ep.method} ${ep.url}`);
        console.log(`    Contagem: ${ep.count}`);
        console.log(`    Status HTTP: ${Array.from(ep.statusCodes).join(', ')}`);
        console.log(`    Parâmetros: ${ep.sampleParams || '(nenhum)'}`);
        if (ep.sampleRequestBody) {
            console.log(`    Request Body Exemplo:`, JSON.stringify(ep.sampleRequestBody, null, 2));
        }
        if (ep.sampleResponseText) {
            console.log(`    Response Exemplo:`, JSON.stringify(ep.sampleResponseText, null, 2).substring(0, 800) + '...');
        }
    });
}

parseHar();
