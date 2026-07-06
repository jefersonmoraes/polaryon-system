const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = 'cd /var/www/polaryon && rm -rf node_modules/.vite && rm -rf dist && rm -rf dist_new && rm -rf dist_electron && rm -rf dist_old && npx vite build --outDir dist && ln -s dist dist_electron && echo BUILD_DONE && ls assets/BudgetsPage-*.js && echo DEPLOY_OK';
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', (err) => {
  console.error('SSH error:', err.message);
}).connect({ host: '191.252.93.79', port: 22, username: 'root', password: 'Jaguar2018#' });
