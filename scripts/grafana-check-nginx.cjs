const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  const nginx = await x('cat /etc/nginx/sites-enabled/default');
  if (nginx.includes('grafana')) {
    console.log('Grafana AINDA no nginx!');
    // Find lines with grafana
    const lines = nginx.split('\n');
    lines.forEach((l, i) => {
      if (l.includes('grafana')) console.log(`Line ${i+1}: ${l.trim()}`);
    });
  } else {
    console.log('Grafana removido do nginx OK');
  }
  
  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
