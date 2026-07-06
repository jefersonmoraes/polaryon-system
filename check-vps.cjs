const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'cd /var/www/polaryon',
    'git log --oneline -3',
    'echo "---GREP---"',
    'grep -n "SEM FAVORITO" src/pages/BudgetsPage.tsx || echo NOT_FOUND',
    'echo "---GREP2---"',
    'grep -n "budget.items" src/pages/BudgetsPage.tsx | head -5',
    'echo "---GREP3---"',
    'grep -n "totalSupplierCost" src/pages/BudgetsPage.tsx | head -5'
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
