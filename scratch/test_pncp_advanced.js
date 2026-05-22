import axios from 'axios';

async function run() {
    try {
        console.log('1. Probing v1/contratacoes?pagina=1...');
        const res1 = await axios.get('https://pncp.gov.br/api/consulta/v1/contratacoes?pagina=1', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('Success!', Object.keys(res1.data));
    } catch (e) {
        console.log('Failed v1/contratacoes:', e.response?.status, e.response?.data || e.message);
    }

    try {
        console.log('2. Probing v1/contratacoes/publicacao with dataInicial and dataFinal...');
        // Let's see if we can omit modalidade
        const res2 = await axios.get('https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20260501&dataFinal=20260510&pagina=1', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('Success without modalidade!', Object.keys(res2.data));
    } catch (e) {
        console.log('Failed publicacao without modalidade:', e.response?.status, e.response?.data || e.message);
    }
}

run();
