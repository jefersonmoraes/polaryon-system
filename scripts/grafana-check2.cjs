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
  
  const code2 = await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://polaryon.com.br/grafana-9e04672b4ef4e3ae859ebfa539cf5d20/ --resolve polaryon.com.br:443:127.0.0.1");
  console.log('Grafana /:', code2);
  
  // Check actual redirect
  const redirect = await exec("curl -s -o /dev/null -w '%{redirect_url}' --max-time 5 https://polaryon.com.br/grafana-9e04672b4ef4e3ae859ebfa539cf5d20/login --resolve polaryon.com.br:443:127.0.0.1");
  console.log('Redirect target:', redirect);
  
  // Check if login page returns HTML
  const page = await exec('curl -s --max-time 5 http://127.0.0.1:3001/login 2>&1 | head -5');
  console.log('Grafana login preview:', page.substring(0, 200));
  
  conn.end();
}).connect({ host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
