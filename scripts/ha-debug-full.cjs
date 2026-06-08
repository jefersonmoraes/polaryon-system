const { Client } = require('ssh2');
const c = new Client();
const HA_SECRET = '4d151307e73ccfb9b7b84ff31e9a2f6c';
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  // 1. Get a valid JWT
  const loginRes = await x("curl -s --max-time 5 -X POST 'http://localhost:3000/api/auth/desktop-login' -H 'Content-Type: application/json' -d '{\"email\":\"jefersonmoraes72@gmail.com\"}'");
  const tk = loginRes.match(/"token":"([^"]+)"/);
  if (!tk) { console.log('Login failed:', loginRes.substring(0,200)); c.end(); return; }
  const jwt = tk[1];
  console.log('JWT obtido');

  // 2. Call set-cookie via POST
  const scRes = await x("curl -s -v --max-time 5 -X POST -H 'Authorization: Bearer " + jwt + "' 'http://localhost:3000/api/auth/set-cookie' 2>&1");
  console.log('set-cookie response:', scRes.substring(scRes.indexOf('<')));
  
  // 3. Now try HA via nginx WITH the cookie  
  const haRes = await x("curl -s -v --max-time 5 -b 'polaryon_token=" + jwt + "' 'https://polaryon.com.br/hass-" + HA_SECRET + "/' --resolve polaryon.com.br:443:127.0.0.1 2>&1");
  console.log('\n=== HA via nginx (com cookie) ===');
  console.log(haRes.substring(haRes.indexOf('>')));

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:30000});
