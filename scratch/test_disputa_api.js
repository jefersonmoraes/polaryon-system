import axios from 'axios';

async function testDisputa() {
    const idCompra = '29000206002052026';
    const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${idCompra}/itens/em-disputa`;
    
    try {
        console.log(`Testando endpoint: ${url}`);
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        console.log('STATUS:', res.status);
        console.log('DADOS:', JSON.stringify(res.data, null, 2).substring(0, 1000));
    } catch (e) {
        console.error('ERRO:', e.message);
    }
}

testDisputa();
