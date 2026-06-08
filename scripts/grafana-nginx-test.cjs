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
  
  // Test via nginx with -L
  const r = await exec("curl -sL -o /tmp/grafana.html -w '%{http_code} %{size_download}' --max-time 10 'https://polaryon.com.br/grafana-9e04672b4ef4e3ae859ebfa539cf5d20/login' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('nginx + follow:', r);
  
  const cat = await exec("head -50 /tmp/grafana.html");
  console.log(cat.substring(0, 1000));
  
  conn.end();
}).connect({ host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
