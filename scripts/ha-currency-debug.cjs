const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  // Test direct call from VPS
  const direct = await x('curl -s --max-time 10 "https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL" 2>&1');
  console.log('Direct awesomeapi:', direct.substring(0, 300));

  // Test via proxy with verbose
  const proxy = await x("curl -s --max-time 10 'http://localhost:3000/api/currency/quotes' 2>&1");
  console.log('\nProxy:', proxy.substring(0, 300));

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:30000});
