const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = 'cd /var/www/polaryon && git fetch origin main && git reset --hard origin/main && rm -rf node_modules/.vite && rm -rf dist_new && npm run build -- --outDir dist_new && rm -rf dist_old && [ -d dist ] && mv dist dist_old || true && mv dist_new dist && rm -rf dist_electron && ln -s dist dist_electron && rm -rf dist_old && echo DEPLOY_OK && pm2 restart polaryon-backend';
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', (err) => {
  console.error('SSH error:', err.message);
}).connect({ host: '191.252.93.79', port: 22, username: 'root', password: 'Jaguar2018#' });
