const { Client } = require('ssh2');
const c = new Client();
const HA_SECRET = '4d151307e73ccfb9b7b84ff31e9a2f6c';
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  // Test 1: Sem cookie → 302
  const r1 = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 5 'https://polaryon.com.br/hass-" + HA_SECRET + "/' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('Sem cookie:', r1);

  // Test 2: Gerar token JWT válido (usando o desktop-login bypass admin)
  const token = await x("curl -s --max-time 5 -X POST 'https://polaryon.com.br/api/auth/desktop-login' -H 'Content-Type: application/json' -d '{\"email\":\"jefersonmoraes72@gmail.com\"}' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('Token response:', token.substring(0, 200));
  
  // Extract token
  const tkMatch = token.match(/"token":"([^"]+)"/);
  if (!tkMatch) {
    console.log('Falha ao obter token');
    c.end();
    return;
  }
  const jwt = tkMatch[1];
  console.log('JWT:', jwt.substring(0, 50) + '...');

  // Test 3: Com cookie → 200
  const r2 = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 5 -b 'polaryon_token=" + jwt + "' 'https://polaryon.com.br/hass-" + HA_SECRET + "/' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('Com cookie JWT:', r2);

  // Test 4: Verificar set-cookie endpoint
  const r3 = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST -H 'Authorization: Bearer " + jwt + "' 'https://polaryon.com.br/api/auth/set-cookie' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('set-cookie endpoint:', r3);

  // Test 5: Verify endpoint com cookie
  const r4 = await x("curl -s --max-time 5 -b 'polaryon_token=" + jwt + "' 'https://polaryon.com.br/api/auth/verify' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('verify com cookie:', r4.substring(0, 200));

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
