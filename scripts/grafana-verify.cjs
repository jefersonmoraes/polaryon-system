const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });
  const r = await x("curl -s -o /tmp/gf.html -w '%{http_code} %{size_download}' --max-time 10 'https://polaryon.com.br/grafana-9e04672b4ef4e3ae859ebfa539cf5d20/login' --resolve polaryon.com.br:443:127.0.0.1");
  console.log('Response:', r);
  const html = await x('head -50 /tmp/gf.html 2>&1');
  console.log(html.substring(0, 1500));
  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
