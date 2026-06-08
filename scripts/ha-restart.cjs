const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  // Restart HA
  const restart = await x('docker restart homeassistant 2>&1');
  console.log('Restart:', restart);
  
  // Wait for HA to come back up
  await new Promise(r => setTimeout(r, 15000));
  
  // Check status
  for (let i = 0; i < 6; i++) {
    const code = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 3 'https://polaryon.com.br/hass-4d151307e73ccfb9b7b84ff31e9a2f6c/' --resolve polaryon.com.br:443:127.0.0.1");
    console.log('HA status:', code);
    if (code === '200') break;
    await new Promise(r => setTimeout(r, 5000));
  }
  
  // Verify config
  const verify = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 5 'https://polaryon.com.br/hass-4d151307e73ccfb9b7b84ff31e9a2f6c/api/config' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('HA API:', verify);
  
  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
