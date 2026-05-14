
import axios from 'axios';

async function test() {
    try {
        const url = 'https://pncp.gov.br/api/pncp/v1/contratacoes';
        const params = {
            pagina: 1,
            tamanhoPagina: 10,
            idSistemaOrigem: 12 
        };
        
        const res = await axios.get(url, {
            params: params,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        console.log('Results count:', res.data.data?.length || 0);
        if (res.data.data && res.data.data.length > 0) {
             console.log('First item ID:', res.data.data[0].numeroControlePNCP);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
