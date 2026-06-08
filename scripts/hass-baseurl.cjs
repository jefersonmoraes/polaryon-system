const { Client } = require('ssh2');
const conn = new Client();
const VPS = { host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 };
const SECRET = '4d151307e73ccfb9b7b84ff31e9a2f6c';
const exec = (cmd) => new Promise((res, rej) => {
    conn.exec(cmd, (err, stream) => {
        if (err) return rej(err);
        let out = '';
        stream.on('data', (d) => out += d.toString());
        stream.on('close', () => res(out.trim()));
        stream.stderr.on('data', (d) => out += d.toString());
    });
});
(async () => {
    await new Promise((resolve, reject) => {
        conn.on('ready', resolve).on('error', reject).connect(VPS);
    });

    // Config HA with base_url + trusted_proxies
    // Write HA config
    const haConfig = `# Configuração Home Assistant
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
  base_url: https://polaryon.com.br/hass-${SECRET}/
`;

    const b64 = Buffer.from(haConfig).toString('base64');
    await exec('echo ' + b64 + ' | base64 -d > /opt/homeassistant/config/configuration.yaml');
    console.log('Config written');

    // Restart HA container to apply config
    await exec('docker restart homeassistant');
    console.log('HA restarting...');
    await new Promise(r => setTimeout(r, 5000));

    // Update nginx: add X-Forwarded-For/X-Forwarded-Proto back (now HA will accept them)
    const nginxConfig = `server {
    root /var/www/polaryon/dist_electron;
    index index.html;
    server_name polaryon.com.br www.polaryon.com.br;
    client_max_body_size 200M;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /download/ {
        alias /var/www/polaryon/storage/download/;
        autoindex on;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        add_header Pragma "no-cache";
    }
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    # Home Assistant (acesso secreto)
    location /hass-${SECRET}/ {
        proxy_pass http://127.0.0.1:8123/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect / /hass-${SECRET}/;
    }
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/polaryon.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/polaryon.com.br/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
server {
    if ($host = www.polaryon.com.br) {
        return 301 https://$host$request_uri;
    }
    if ($host = polaryon.com.br) {
        return 301 https://$host$request_uri;
    }
    server_name polaryon.com.br www.polaryon.com.br;
    listen 80;
    return 404;
}
`;
    const b642 = Buffer.from(nginxConfig.trimStart()).toString('base64');
    await exec('echo ' + b642 + ' | base64 -d > /etc/nginx/sites-enabled/default');
    
    const test = await exec('nginx -t 2>&1');
    console.log('Nginx test:', test);
    if (test.includes('successful') || test.includes('ok')) {
        await exec('systemctl reload nginx 2>&1');
        console.log('Nginx reloaded');
    }

    // Test HA
    console.log('\n=== HA test ===');
    const r = await exec("curl -sL --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -c 500");
    console.log(r);

    console.log('\n=== Final URL ===');
    console.log(await exec("curl -s -o /dev/null -w 'Status: %{http_code}\\nFinal: %{url_effective}\\n' --max-time 10 -L --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/"));

    // Cleanup
    await exec('rm -f /tmp/hass-*.py');
    conn.end();
})();
