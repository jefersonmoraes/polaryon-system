const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  // Write config via base64 to preserve exact formatting
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

panel_iframe:
  grafana:
    title: "Grafana"
    icon: "mdi:chart-box-outline"
    url: "https://polaryon.com.br/grafana-9e04672b4ef4e3ae859ebfa539cf5d20/"
`;

  const b64 = Buffer.from(config).toString('base64');
  const r = await x(`echo ${b64} | base64 -d > /opt/homeassistant/config/configuration.yaml`);
  console.log('Write result:', r);
  
  // Verify
  const verify = await x('cat /opt/homeassistant/config/configuration.yaml');
  console.log('Updated config:');
  console.log(verify);
  
  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
