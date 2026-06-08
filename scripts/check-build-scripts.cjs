const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  const pkg = await x('cat /var/www/polaryon/package.json');
  const parsed = JSON.parse(pkg);
  console.log('Root scripts:', JSON.stringify(parsed.scripts, null, 2));

  const backendPkg = await x('cat /var/www/polaryon/backend/package.json');
  const bParsed = JSON.parse(backendPkg);
  console.log('\nBackend scripts:', JSON.stringify(bParsed.scripts, null, 2));

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
