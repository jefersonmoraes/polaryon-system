const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '204.168.151.231',
  port: 22,
  username: 'root',
  password: 'Jaguar2018jolela#'
};

conn.on('ready', () => {
  console.log('Cliente :: conexao pronta');
  
  // Roda o mesmo script do github action
  const cmd = `cd /var/www/polaryon && git fetch origin main && git reset --hard origin/main && bash -l vps-deploy.sh`;
  console.log(`Executando comando no VPS: ${cmd}`);
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Comando finalizado. Codigo de saida: ' + code);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).on('error', (err) => {
  console.error('Erro de conexao SSH:', err);
}).connect(config);
