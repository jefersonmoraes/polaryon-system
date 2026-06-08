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
  const logs = await exec('docker logs grafana 2>&1');
  console.log(logs);
  conn.end();
}).connect({ host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
