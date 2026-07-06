const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = 'grep -n "location.*assets" /etc/nginx/sites-enabled/default -A5 && echo "---" && nginx -t 2>&1';
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', (err) => {
  console.error('SSH error:', err.message);
}).connect({ host: '191.252.93.79', port: 22, username: 'root', password: 'Jaguar2018#' });
