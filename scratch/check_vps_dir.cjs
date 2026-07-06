const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  // Direct bash commands to force remove symlinks and folders
  const cmd = `
echo "=== Cleaning files ==="
rm -fv /var/www/polaryon/dist/download
rm -fv /var/www/polaryon/storage/download
rm -rfv /var/www/polaryon/dist
rm -rfv /var/www/polaryon/dist_electron
rm -rfv /var/www/polaryon/storage/download
mkdir -pv /var/www/polaryon/storage/download
echo "=== Done cleaning ==="
`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.stderr.on('data', d => out += '[ERR] ' + d.toString());
    stream.on('close', (code) => {
      console.log(out);
      console.log(`Done with code: ${code}`);
      conn.end();
    });
  });
}).connect({ host: '191.252.93.79', port: 22, username: 'root', password: 'Jaguar2018#' });
