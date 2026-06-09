const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  const q1 = await x("curl -s --max-time 10 'https://open.er-api.com/v6/latest/USD' 2>&1");
  console.log('er-api:', q1.substring(0, 300));

  const q2 = await x("curl -s --max-time 10 'http://localhost:3000/api/currency/quotes' 2>&1");
  console.log('\nProxy:', q2.substring(0, 300));

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:30000});
