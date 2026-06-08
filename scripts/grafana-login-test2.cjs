const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const exec = (cmd) => new Promise((res, rej) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return rej(err);
      let out = '';
      stream.on('data', d => out += d);
      stream.on('close', () => res(out.trim()));
      stream.stderr.on('data', d => out += d);
    });
  });
  
  // Follow redirects
  const loginPage = await exec("curl -sL --max-time 5 'https://polaryon.com.br/grafana-9e04672b4ef4e3ae859ebfa539cf5d20/login' --resolve polaryon.com.br:443:127.0.0.1 2>&1 | head -30");
  console.log('Login page (-L):');
  console.log(loginPage.substring(0, 1500));
  
  // Direct to Grafana
  const direct = await exec("curl -sL --max-time 5 http://127.0.0.1:3001/login 2>&1 | head -20");
  console.log('\nDirect login:', direct.substring(0, 500));
  
  conn.end();
}).connect({ host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
