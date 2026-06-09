const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });
  const r = await x("curl -s --max-time 10 'https://polaryon.com.br/api/currency/quotes' --resolve polaryon.com.br:443:127.0.0.1");
  console.log(r);
  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:30000});
