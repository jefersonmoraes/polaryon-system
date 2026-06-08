const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  // Check compiled JS for getCookie and set-cookie
  const js = await x('grep -n "getCookie\\|set-cookie\\|polaryon_token" /var/www/polaryon/backend/dist/routes/auth.js');
  console.log('Compiled JS matches:');
  console.log(js);
  
  // Also check if the function exists
  const func = await x('grep -n "function getCookie\\|router.post.*set-cookie\\|router.get.*verify" /var/www/polaryon/backend/dist/routes/auth.js');
  console.log('\nFunctions:', func);

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
