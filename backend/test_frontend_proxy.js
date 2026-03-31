const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/transparency/pncp-proxy', {
      params: {
        q: 'notebooks',
        status: ['recebendo_proposta', 'encerradas'],
        tipos_documento: ['edital', 'aviso_contratacao_direta', 'ata', 'contrato'],
        pagina: 1,
        tamanho_pagina: 12
      }
    });
    console.log("Total:", res.data.total);
    console.log("Items:", res.data.items?.length);
  } catch(e) {
    console.log("Error:", e.response?.data || e.message);
  }
}
test();
