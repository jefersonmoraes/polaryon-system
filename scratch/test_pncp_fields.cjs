const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  // Let's query the search endpoint with q=compras.gov.br:
  const cmd = 'curl -s -H "User-Agent: Mozilla/5.0" "https://pncp.gov.br/api/search/?q=compras.gov.br&pagina=1&tam_pagina=2&tipos_documento=edital"';
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => {
      try {
        const parsed = JSON.parse(out);
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log("RAW OUTPUT:", out);
      }
      conn.end();
    });
  });
}).connect({ host: '191.252.93.79', port: 22, username: 'root', password: 'Jaguar2018#' });
