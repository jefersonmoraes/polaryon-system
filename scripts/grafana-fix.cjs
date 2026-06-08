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
  
  // Fix permissions
  console.log('Fixing perms...');
  const chown = await exec('chown -R 472:472 /opt/grafana/data 2>&1 && echo OK');
  console.log('chown:', chown);
  
  // Remove old container
  await exec('docker rm -f grafana 2>&1');
  
  // Run again
  const run = await exec('docker run -d --name grafana --restart unless-stopped -p 127.0.0.1:3001:3000 -v /opt/grafana/data:/var/lib/grafana -e GF_SERVER_ROOT_URL=https://polaryon.com.br/grafana-9e04672b4ef4e3ae859ebfa539cf5d20/ -e GF_SERVER_SERVE_FROM_SUB_PATH=true grafana/grafana:latest 2>&1');
  console.log('Docker run:', run);
  
  conn.end();
}).connect({ host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
