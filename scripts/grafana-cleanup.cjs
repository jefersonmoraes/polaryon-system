const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  const config = `# Configuração Home Assistant
default_config:

homeassistant:
  name: Casa
  unit_system: metric
  time_zone: America/Sao_Paulo

http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1
  base_url: https://polaryon.com.br/hass-4d151307e73ccfb9b7b84ff31e9a2f6c/
`;

  const b64 = Buffer.from(config).toString('base64');
  await x('echo ' + b64 + ' | base64 -d > /opt/homeassistant/config/configuration.yaml');
  
  const config2 = await x('cat /opt/homeassistant/config/configuration.yaml');
  console.log('Restored config:');
  console.log(config2);
  
  // Remove nginx Grafana location
  console.log('\n=== Removendo Grafana do nginx ===');
  const nginx = await x('cat /etc/nginx/sites-enabled/default');
  // Use sed to remove the Grafana block
  const sed = await x("sed -i '/location \\/grafana-/,/^    }$/d' /etc/nginx/sites-enabled/default 2>&1");
  console.log('sed:', sed);
  
  const nginxTest = await x('nginx -t 2>&1');
  console.log('nginx test:', nginxTest);
  if (nginxTest.includes('successful')) {
    await x('systemctl reload nginx 2>&1');
    console.log('Nginx reloaded');
  }
  
  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
