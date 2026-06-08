const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });
  // Test with custom headers to see what Grafana does
  const r = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H 'X-Forwarded-Proto: https' -H 'X-Forwarded-For: 127.0.0.1' -H 'X-Forwarded-Host: polaryon.com.br' -H 'X-Real-IP: 127.0.0.1' 'https://polaryon.com.br/grafana-9e04672b4ef4e3ae859ebfa539cf5d20/' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('With X-Forwarded:', r);
  
  // Check what Grafana logs show
  const logs = await x('docker logs grafana --tail 20 2>&1');
  console.log('\nGrafana logs:');
  console.log(logs);
  
  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
