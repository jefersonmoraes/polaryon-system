const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Conectado ao VPS. Iniciando deploy...');
  
  const cmd = 'cd /var/www/polaryon && git fetch origin main && git reset --hard origin/main && bash -l vps-deploy.sh';
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log(`Deploy concluído (código: ${code})`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect({
  host: '204.168.151.231',
  port: 22,
  username: 'root',
  password: 'Jaguar2018jolela#'
});
