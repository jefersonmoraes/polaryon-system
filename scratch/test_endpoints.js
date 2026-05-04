
const urls = [
    'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa-externa/v1/disputas/compras/participacao',
    'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/participacao',
    'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/v1/compras/participacao',
    'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa-externa/v1/divulgacao/compras',
    'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa-externa/v1/compras/participacao',
    'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/participacao?pagina=0&tamanhoPagina=100'
];

async function check() {
    for (const url of urls) {
        try {
            const res = await fetch(url);
            console.log(`[${res.status}] ${url}`);
        } catch (e) {
            console.log(`[ERROR] ${url}: ${e.message}`);
        }
    }
}
check();
