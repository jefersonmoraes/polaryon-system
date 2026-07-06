const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  // Fix git refs lock issue and run deploy
  const cmd = `
cd /var/www/polaryon &&
git remote prune origin 2>/dev/null || true &&
rm -f .git/refs/remotes/origin/main &&
git fetch origin main &&
git reset --hard origin/main &&
echo "=== Git OK at $(git rev-parse --short HEAD), running deploy ===" &&
/bin/bash /var/www/polaryon/vps-deploy.sh
`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      console.log(`\nDone with code: ${code}`);
      conn.end();
    });
  });
}).connect({ host: '191.252.93.79', port: 22, username: 'root', password: 'Jaguar2018#' });
