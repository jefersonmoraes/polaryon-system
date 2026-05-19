import axios from 'axios';

async function test() {
    try {
        const url = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/20033806000852026/itens';
        const res = await axios.get(url);
        console.log("Raw response:");
        console.log(JSON.stringify(res.data, null, 2).substring(0, 1000));
    } catch (e) {
        console.error("Error:", e.response ? e.response.status : e.message);
    }
}
test();
