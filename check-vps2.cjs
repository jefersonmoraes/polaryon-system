const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'echo "---NGINX ROOT---"',
    'grep -r "root" /etc/nginx/sites-enabled/ 2>/dev/null | head -5',
    'echo "---DIST CONTENT---"',
    'ls -la /var/www/polaryon/dist/ | head -5',
    'echo "---SYMLINK---"',
    'ls -la /var/www/polaryon/dist_electron',
    'echo "---BUDGETS FILE SIZE---"',
    'wc -c /var/www/polaryon/dist/assets/BudgetsPage-*.js 2>/dev/null || echo NOT_FOUND'
  ].join(' && ');
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', (err) => {
  console.error('SSH error:', err.message);
}).connect({ host: '191.252.93.79', port: 22, username: 'root', password: 'Jaguar2018#' });
