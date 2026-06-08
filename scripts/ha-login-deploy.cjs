const { Client } = require('ssh2');
const fs = require('fs');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  // Upload LoginPage.tsx
  const loginContent = fs.readFileSync('E:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\src\\pages\\LoginPage.tsx', 'utf8');
  const b64 = Buffer.from(loginContent).toString('base64');
  await x('echo ' + b64 + ' | base64 -d > /var/www/polaryon/src/pages/LoginPage.tsx');
  console.log('Uploaded LoginPage.tsx');

  // Build frontend
  console.log('Building frontend...');
  const build = await x('cd /var/www/polaryon && npm run build 2>&1');
  console.log('Build:', build.substring(0, 1000));

  // Test
  const r3 = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 5 -b 'polaryon_token=test' 'https://polaryon.com.br/hass-4d151307e73ccfb9b7b84ff31e9a2f6c/' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('HA (with bad token):', r3, '(should be 302 → login)');

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:120000});
