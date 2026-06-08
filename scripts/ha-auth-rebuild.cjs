const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  // Rebuild backend
  console.log('=== Rebuilding backend ===');
  const build = await x('cd /var/www/polaryon/backend && npm run build 2>&1');
  console.log('Build:', build.substring(0, 1000));

  // Restart
  const restart = await x('pm2 restart polaryon-backend 2>&1');
  console.log('Restart:', restart);

  // Test
  await new Promise(r => setTimeout(r, 5000));

  const tokenRes = await x("curl -s --max-time 5 -X POST 'http://localhost:3000/api/auth/desktop-login' -H 'Content-Type: application/json' -d '{\"email\":\"jefersonmoraes72@gmail.com\"}'");
  const tk = tokenRes.match(/"token":"([^"]+)"/);
  if (!tk) { console.log('Token fail'); c.end(); return; }
  const jwt = tk[1];

  // Test set-cookie
  const r1 = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST -H 'Authorization: Bearer " + jwt + "' 'http://localhost:3000/api/auth/set-cookie'");
  console.log('set-cookie:', r1);

  // Test verify with cookie
  const r2 = await x("curl -s --max-time 5 -b 'polaryon_token=" + jwt + "' 'http://localhost:3000/api/auth/verify'");
  console.log('verify with cookie:', r2.substring(0, 200));

  // Test via nginx with cookie
  const r3 = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 5 -b 'polaryon_token=" + jwt + "' 'https://polaryon.com.br/hass-4d151307e73ccfb9b7b84ff31e9a2f6c/' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('HA via nginx:', r3);

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:120000});
