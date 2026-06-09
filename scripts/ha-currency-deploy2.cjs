const { Client } = require('ssh2');
const fs = require('fs');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  for (const [local, remote] of [
    ['E:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\backend\\src\\routes\\currency.ts', '/var/www/polaryon/backend/src/routes/currency.ts'],
    ['E:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\src\\components\\layout\\AppSidebar.tsx', '/var/www/polaryon/src/components/layout/AppSidebar.tsx'],
  ]) {
    const content = fs.readFileSync(local, 'utf8');
    const b64 = Buffer.from(content).toString('base64');
    await x('echo ' + b64 + ' | base64 -d > ' + remote);
  }
  console.log('Files uploaded');

  console.log(await x('cd /var/www/polaryon/backend && npm run build 2>&1'));
  await x('pm2 restart polaryon-backend 2>&1');
  console.log(await x('cd /var/www/polaryon && npm run build 2>&1 | tail -5'));

  const quotes = await x("curl -s --max-time 10 'http://localhost:3000/api/currency/quotes'");
  console.log('Currency quotes:', quotes);

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:180000});
