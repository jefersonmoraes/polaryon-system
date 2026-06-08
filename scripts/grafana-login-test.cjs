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
  
  // Test via nginx - login page
  const loginPage = await exec("curl -s --max-time 5 'https://polaryon.com.br/grafana-9e04672b4ef4e3ae859ebfa539cf5d20/login' --resolve polaryon.com.br:443:127.0.0.1 2>&1 | head -20");
  console.log('Login page via nginx:');
  console.log(loginPage.substring(0, 1000));
  
  conn.end();
}).connect({ host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
