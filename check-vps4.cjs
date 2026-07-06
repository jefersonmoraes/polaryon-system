const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = 'grep -o "budget.items\\[0\\]" /var/www/polaryon/dist/assets/BudgetsPage-*.js | wc -l && grep -c "supplierCost" /var/www/polaryon/dist/assets/BudgetsPage-*.js';
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', (err) => {
  console.error('SSH error:', err.message);
}).connect({ host: '191.252.93.79', port: 22, username: 'root', password: 'Jaguar2018#' });
