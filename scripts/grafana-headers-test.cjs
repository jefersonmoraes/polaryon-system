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
  
  // Check response headers
  const r = await exec("curl -sI --max-time 5 'https://polaryon.com.br/grafana-9e04672b4ef4e3ae859ebfa539cf5d20/login' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('HEADERS:');
  console.log(r);
  
  conn.end();
}).connect({ host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
