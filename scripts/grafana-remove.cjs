const { Client } = require('ssh2');
const c = new Client();
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  console.log('=== Removendo Grafana ===');
  
  // Stop and remove container
  const rm = await x('docker rm -f grafana 2>&1');
  console.log('docker rm:', rm);
  
  // Verify
  const ps = await x('docker ps -a --filter name=grafana --format "{{.Names}} {{.Status}}" && docker ps -a --filter name=grafana --format "{{.Names}} {{.Status}}" 2>&1');
  console.log('Grafana containers:', ps || '(none)');
  
  // Remove from HA config
  console.log('\n=== Removendo panel_iframe do HA ===');
  const pyCmd = "python3 -c \"import yaml\nwith open('/opt/homeassistant/config/configuration.yaml') as f:\n    data = yaml.safe_load(f)\nif 'panel_iframe' in data and 'grafana' in data['panel_iframe']:\n    del data['panel_iframe']['grafana']\n    if not data['panel_iframe']:\n        del data['panel_iframe']\nwith open('/opt/homeassistant/config/configuration.yaml', 'w') as f:\n    yaml.dump(data, f, default_flow_style=False)\nprint('OK')\"";
  const py = await x(pyCmd);
  console.log('Python result:', py);
  
  // Show HA config
  const config = await x('cat /opt/homeassistant/config/configuration.yaml');
  console.log('HA config:', config);
  
  // Restart HA
  console.log('\n=== Reiniciando HA ===');
  const restart = await x('docker restart homeassistant 2>&1');
  console.log('Restart:', restart);
  
  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
