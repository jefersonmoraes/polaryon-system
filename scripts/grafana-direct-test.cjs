const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const exec = (cmd) => new Promise((res, rej) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return rej(err);
      let out = '';
      stream.on('data', d => out += d.toString());
      stream.on('close', () => res(out));
      stream.stderr.on('data', d => out += d.toString());
    });
  });
  
  // Simple test
  const r1 = await exec('curl -s http://127.0.0.1:3001/');
  console.log('DIRECT /', r1.length, 'bytes');
  if (r1.length) console.log(r1.substring(0,300));
  
  const r2 = await exec('curl -s http://127.0.0.1:3001/login');
  console.log('\nDIRECT /login', r2.length, 'bytes');
  if (r2.length) console.log(r2.substring(0,500));
  
  conn.end();
}).connect({ host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
