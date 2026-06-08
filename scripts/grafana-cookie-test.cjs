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
  
  // With cookie jar
  const r = await exec("curl -sL -c /tmp/gf.cookies -b /tmp/gf.cookies -o /tmp/gf.html -w '%{http_code} %{url_effective}' --max-time 10 'https://polaryon.com.br/grafana-9e04672b4ef4e3ae859ebfa539cf5d20/' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('Result:', r);
  
  const size = await exec('wc -c /tmp/gf.html');
  console.log('Size:', size);
  
  const head = await exec('head -30 /tmp/gf.html');
  console.log('Content:', head.substring(0, 1000));
  
  conn.end();
}).connect({ host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
