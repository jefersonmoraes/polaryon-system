const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  // Get a token directly from the backend (bypass nginx)
  const tokenRes = await x("curl -s --max-time 5 -X POST 'http://localhost:3000/api/auth/desktop-login' -H 'Content-Type: application/json' -d '{\"email\":\"jefersonmoraes72@gmail.com\"}'");
  const tk = tokenRes.match(/"token":"([^"]+)"/);
  if (!tk) { console.log('Token fail:', tokenRes.substring(0,200)); c.end(); return; }
  const jwt = tk[1];

  // Test set-cookie directly
  const r1 = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST -H 'Authorization: Bearer " + jwt + "' 'http://localhost:3000/api/auth/set-cookie'");
  console.log('set-cookie direct:', r1);

  // Test verify with cookie (use raw Cookie header)
  const r2 = await x("curl -s --max-time 5 -H 'Cookie: polaryon_token=" + jwt + "' 'http://localhost:3000/api/auth/verify'");
  console.log('verify with Cookie header:', r2.substring(0, 200));

  // Test verify with -b
  const r3 = await x("curl -s --max-time 5 -b 'polaryon_token=" + jwt + "' 'http://localhost:3000/api/auth/verify'");
  console.log('verify with -b flag:', r3.substring(0, 200));

  // Also test which cookie is actually received by the backend
  const r4 = await x("curl -s -v --max-time 5 -b 'polaryon_token=" + jwt + "' 'http://localhost:3000/api/auth/verify' 2>&1 | head -30");
  console.log('VERBOSE:', r4);

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
