const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  // Add cache-bust timestamp to index.html and add no-cache headers
  const ts = Date.now();
  const cmd = [
    `sed -i 's|</head>|<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"></head>|' /var/www/polaryon/dist/index.html`,
    `sed -i 's|</head>|<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"></head>|' /var/www/polaryon/dist/desktop.html`,
    `echo "HTML updated at ${ts}"`,
    'nginx -t 2>&1 && systemctl reload nginx && echo NGINX_RELOADED'
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
