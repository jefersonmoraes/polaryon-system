import { chromium } from 'playwright';

async function sniffPCPKey() {
    console.log('[SNIFFER] Iniciando navegador...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('[SNIFFER] Navegando para o Portal de Compras Públicas...');
    
    let capturedUrl = '';

    // Interceptar requisições
    page.on('request', request => {
        const url = request.url();
        if (url.includes('apipcp.portaldecompraspublicas.com.br')) {
            console.log('[SNIFFER] Requisição detectada:', url);
            if (url.includes('publicKey=')) {
                capturedUrl = url;
            }
        }
    });

    try {
        await page.goto('https://www.portaldecompraspublicas.com.br/18/Processos/', { waitUntil: 'networkidle' });
        
        // Clicar no botão de pesquisar se necessário, mas geralmente ele já carrega algo
        console.log('[SNIFFER] Aguardando carregamento dos processos...');
        await page.waitForTimeout(5000);

        if (!capturedUrl) {
            console.log('[SNIFFER] Forçando busca para gerar tráfego...');
            await page.click('button:has-text("Pesquisar")').catch(() => {});
            await page.waitForTimeout(5000);
        }

        if (capturedUrl) {
            console.log('\n[RESULTADO] URL COMPLETA ENCONTRADA:');
            console.log(capturedUrl);
            
            const urlObj = new URL(capturedUrl);
            const key = urlObj.searchParams.get('publicKey');
            console.log('\n[RESULTADO] PUBLIC_KEY:', key);
        } else {
            console.log('[ERRO] Nenhuma requisição de API capturada.');
        }

    } catch (err) {
        console.error('[ERRO]', err);
    } finally {
        await browser.close();
    }
}

sniffPCPKey();
