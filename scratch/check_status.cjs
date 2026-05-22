const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('VERIFICANDO STATUS DO VPS...\n');
  
  const commands = [
    'echo "=== ARQUIVOS DE DOWNLOAD ===" && ls -la /var/www/polaryon/storage/download/ 2>&1',
    'echo "=== PM2 STATUS ===" && pm2 status 2>&1',
    'echo "=== GIT LOG ===" && cd /var/www/polaryon && git log --oneline -3 2>&1',
    'echo "=== VERSAO PACKAGE ===" && cat /var/www/polaryon/package.json | grep version 2>&1'
  ];
  
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { conn.end(); return; }
    conn.exec(commands[idx], (err, stream) => {
      if (err) { console.error('Erro:', err); conn.end(); return; }
      let output = '';
      stream.on('data', (d) => output += d.toString());
      stream.stderr.on('data', (d) => output += d.toString());
      stream.on('close', () => {
        console.log(output);
        idx++;
        runNext();
      });
    });
  }
  runNext();
}).connect({
  host: '204.168.151.231',
  port: 22,
  username: 'root',
  password: 'Jaguar2018jolela#'
});
