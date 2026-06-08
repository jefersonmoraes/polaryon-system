const { Client } = require('ssh2');
const fs = require('fs');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  // Upload both files
  for (const [local, remote] of [
    ['E:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\src\\store\\auth-store.ts', '/var/www/polaryon/src/store/auth-store.ts'],
    ['E:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\src\\pages\\LoginPage.tsx', '/var/www/polaryon/src/pages/LoginPage.tsx'],
  ]) {
    const content = fs.readFileSync(local, 'utf8');
    const b64 = Buffer.from(content).toString('base64');
    await x('echo ' + b64 + ' | base64 -d > ' + remote);
    console.log('Uploaded', remote.split('/').pop());
  }

  // Build
  console.log('Building frontend...');
  const build = await x('cd /var/www/polaryon && npm run build 2>&1');
  console.log('Build:', build.substring(0, 200));

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:180000});
