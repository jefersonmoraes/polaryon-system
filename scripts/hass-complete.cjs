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
    # === HOME ASSISTANT (root-level paths) ===
    # Service Worker
    location = /sw-modern.js {
        proxy_pass http://127.0.0.1:8123/sw-modern.js;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Service-Worker-Allowed /;
    }
    location = /service_worker.js {
        proxy_pass http://127.0.0.1:8123/service_worker.js;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }
    # HA SPA routes (redirected by HA's router)
    location /auth/ {
        proxy_pass http://127.0.0.1:8123;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Encoding "";
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }
    location /lovelace/ {
        proxy_pass http://127.0.0.1:8123;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Encoding "";
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }
    location /states/ {
        proxy_pass http://127.0.0.1:8123;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Encoding "";
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }
    location /config/ {
        proxy_pass http://127.0.0.1:8123;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Encoding "";
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }
    # HA static assets and API (acessados diretamente pela SPA do HA em /auth/ etc)
    location /frontend_latest/ {
        proxy_pass http://127.0.0.1:8123/frontend_latest/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }
    location /frontend_es5/ {
        proxy_pass http://127.0.0.1:8123/frontend_es5/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }
    location /static/ {
        proxy_pass http://127.0.0.1:8123/static/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }
    location = /manifest.json {
        proxy_pass http://127.0.0.1:8123/manifest.json;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
    }
    location /api/brands/ {
        proxy_pass http://127.0.0.1:8123;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
    }
    location /api/onboarding/ {
        proxy_pass http://127.0.0.1:8123/api/onboarding/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
    }
    location = /api/onboarding {
        proxy_pass http://127.0.0.1:8123/api/onboarding;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
    }
    # === POLARYON API ===
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
    # === HOME ASSISTANT (path prefix) ===
    location /hass-${SECRET}/ {
        proxy_pass http://127.0.0.1:8123/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Encoding "";
        proxy_redirect / /hass-${SECRET}/;
        expires epoch;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        sub_filter_types text/html application/manifest+json;
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

    // Verify key paths
    console.log('\n=== Path verification ===');
    const paths = [
        ['/', 'SPA'],
        ['/api/health', 'API'],
        ['/hass-xxx/', 'HA prefix'],
        ['/auth/authorize', 'HA auth'],
        ['/lovelace/0', 'HA lovelace'],
        ['/api/onboarding/installation_type', 'HA onboarding API'],
        ['/sw-modern.js', 'HA SW'],
        ['/static/icons/favicon-192x192.png', 'HA static icons'],
        ['/api/brands/', 'HA brands API'],
        ['/manifest.json', 'HA manifest'],
    ];
    for (const [path, label] of paths) {
        const url = path.replace('hass-xxx', 'hass-' + SECRET);
        const out = await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br" + url + " 2>&1");
        console.log(`  ${label.padEnd(20)} ${url.padEnd(50)} ${out}`);
    }

    conn.end();
})();
