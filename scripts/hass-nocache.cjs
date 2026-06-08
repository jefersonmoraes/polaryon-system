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

    // Rewrite config: add Cache-Control override to all HA locations
    const config = `server {
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
    # Home Assistant API (exact match para nao conflitar com /api/ do Polaryon)
    location = /api/onboarding {
        proxy_pass http://127.0.0.1:8123/api/onboarding;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
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
    # Home Assistant - arquivos estaticos JS (com sub_filter)
    location /hass-${SECRET}/frontend_latest/ {
        proxy_pass http://127.0.0.1:8123/frontend_latest/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        sub_filter_types text/javascript application/javascript;
        sub_filter '/api/onboarding' '/hass-${SECRET}/api/onboarding';
        sub_filter_once off;
    }
    location /hass-${SECRET}/frontend_es5/ {
        proxy_pass http://127.0.0.1:8123/frontend_es5/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        sub_filter_types text/javascript application/javascript;
        sub_filter '/api/onboarding' '/hass-${SECRET}/api/onboarding';
        sub_filter_once off;
    }
    location /hass-${SECRET}/static/ {
        proxy_pass http://127.0.0.1:8123/static/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        sub_filter_types text/javascript application/javascript text/css;
        sub_filter '/api/onboarding' '/hass-${SECRET}/api/onboarding';
        sub_filter_once off;
    }
    location = /hass-${SECRET}/manifest.json {
        proxy_pass http://127.0.0.1:8123/manifest.json;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }
    # Home Assistant - proxy principal
    location /hass-${SECRET}/ {
        proxy_pass http://127.0.0.1:8123/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect / /hass-${SECRET}/;
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        sub_filter_types text/html text/javascript application/javascript;
        sub_filter '/frontend_latest/' '/hass-${SECRET}/frontend_latest/';
        sub_filter '/frontend_es5/' '/hass-${SECRET}/frontend_es5/';
        sub_filter '/static/' '/hass-${SECRET}/static/';
        sub_filter '/manifest.json' '/hass-${SECRET}/manifest.json';
        sub_filter '/api/onboarding' '/hass-${SECRET}/api/onboarding';
        sub_filter_once off;
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
    const b64 = Buffer.from(config.trimStart()).toString('base64');
    await exec('echo ' + b64 + ' | base64 -d > /etc/nginx/sites-enabled/default');

    const test = await exec('nginx -t 2>&1');
    console.log('Nginx test:', test);
    if (test.includes('successful')) {
        await exec('systemctl reload nginx 2>&1');
        console.log('Reloaded OK');
    }

    // Verify no-cache headers
    console.log('\n=== Cache headers ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/onboarding.html 2>&1 | grep -i 'cache\\|expires'"));

    // Verify JS content-type
    console.log('\n=== JS MIME type ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1 | grep -i 'content-type'"));

    // Verify Polaryon still works
    console.log('\n=== Polaryon checks ===');
    console.log(await exec("curl -s -o /dev/null -w 'SPA: %{http_code}, API: ' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/ 2>&1") + await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/api/health"));

    // Check rewrite paths in HTML
    console.log('\n=== Paths no HTML ===');
    const html = await exec("curl -sL --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | grep -oE 'href=\"/[^\"]+' | head -5");
    console.log(html);

    await exec('rm -f /tmp/hass-*.py');
    console.log('\n✅ PRONTO! Abre o link (com cache limpo) e deve funcionar.');
    conn.end();
})();
