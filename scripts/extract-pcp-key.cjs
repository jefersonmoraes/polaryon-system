const https = require('https');

const keys = [
  'b7ad651a44cff961330fe393543796f0',
  'ee129ef1ba4bdcb99989ae71308f90a8',
  'bcff2a2f3d8545be5ac1a6d0e6bc79f5'
];

function testKey(key) {
  return new Promise((resolve) => {
    const url = `https://apipcp.portaldecompraspublicas.com.br/publico/listarProcessos/?publicKey=${key}&cdSituacao=1&dataInicio=01/07/2026&dataFim=15/07/2026&pagina=1`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(`Key ${key.substring(0, 8)}...: ${d.substring(0, 200)}`);
        resolve(d);
      });
    }).on('error', e => {
      console.log(`Key ${key.substring(0, 8)}...: ERR ${e.message}`);
      resolve(null);
    });
  });
}

async function main() {
  for (const key of keys) {
    await testKey(key);
  }
}

main();
