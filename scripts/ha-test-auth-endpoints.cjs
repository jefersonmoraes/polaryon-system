const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  const tokenRes = await x("curl -s --max-time 5 -X POST 'http://localhost:3000/api/auth/desktop-login' -H 'Content-Type: application/json' -d '{\"email\":\"jefersonmoraes72@gmail.com\"}'");
  const tk = tokenRes.match(/"token":"([^"]+)"/);
  if (!tk) { console.log('Token fail'); c.end(); return; }
  const jwt = tk[1];

  // Test endpoints that use requireAuth
  for (const endpoint of ['/api/users', '/api/audit', '/api/bidding', '/api/calendar']) {
    const res = await x("curl -s -v --max-time 5 -H 'Authorization: Bearer " + jwt + "' 'http://localhost:3000" + endpoint + "' 2>&1");
    const has = res.includes('Set-Cookie: polaryon_token');
    const status = res.match(/< HTTP.*?(\d{3})/);
    console.log(endpoint + ': status=' + (status ? status[1] : '?') + ' cookie=' + has);
  }

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:30000});
