const { Client } = require('ssh2');
const crypto = require('crypto');
const conn = new Client();
const VPS = { host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 };
const HA_SECRET = '4d151307e73ccfb9b7b84ff31e9a2f6c';
const GRAFANA_SECRET = crypto.randomBytes(16).toString('hex'); // 32 hex chars
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

    console.log('Grafana secret path:', GRAFANA_SECRET);

    // Deploy nginx config with Grafana proxy
    const POLARYON_API_REGEX = '^/api/(health|auth/(login|google|desktop-login|verify|register)|users|calendar|kanban|documents|certificates|accounting|audit|sidebar-links|connections|transparency|activity|maintenance|transferegov|bidding|backups|radar)($|/)';

    const config = `server {
    root /var/www/polaryon/dist_electron;
    index index.html;
    server_name polaryon.com.br www.polaryon.com.br;
    client_max_body_size 200M;

    location / { try_files $uri $uri/ /index.html; }

    location /download/ {
        alias /var/www/polaryon/storage/download/;
        autoindex on;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        add_header Pragma "no-cache";
    }

    # Grafana
    location /grafana-${GRAFANA_SECRET}/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
        proxy_redirect http:// https://;
    }

    # HA redirect
    location /auth/ { return 307 /hass-${HA_SECRET}$request_uri; }
    location ~ ^/(lovelace|states|config|logbook|history|map|energy|developer-tools|profile|media-browser|home)($|/) {
        return 307 /hass-${HA_SECRET}$request_uri;
    }

    # No-op SW
    location = /sw-modern.js {
        add_header Content-Type application/javascript;
        add_header Service-Worker-Allowed /;
        return 200 'self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",()=>self.clients.claim());self.addEventListener("fetch",(e)=>e.respondWith(fetch(e.request)));';
    }
    location = /service_worker.js {
        add_header Content-Type application/javascript;
        return 200 'self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",()=>self.clients.claim());self.addEventListener("fetch",(e)=>e.respondWith(fetch(e.request)));';
    }

    # HA assets
    location /frontend_latest/ { proxy_pass http://127.0.0.1:8123/frontend_latest/; proxy_http_version 1.1; proxy_set_header Host 127.0.0.1:8123; proxy_set_header Accept-Encoding ""; }
    location /frontend_es5/ { proxy_pass http://127.0.0.1:8123/frontend_es5/; proxy_http_version 1.1; proxy_set_header Host 127.0.0.1:8123; proxy_set_header Accept-Encoding ""; }
    location /static/ { proxy_pass http://127.0.0.1:8123/static/; proxy_http_version 1.1; proxy_set_header Host 127.0.0.1:8123; proxy_set_header Accept-Encoding ""; }
    location = /manifest.json { proxy_pass http://127.0.0.1:8123/manifest.json; proxy_http_version 1.1; proxy_set_header Host 127.0.0.1:8123; proxy_set_header Accept-Encoding ""; }

    # HA WebSocket
    location /api/websocket {
        proxy_pass http://127.0.0.1:8123/api/websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Polaryon API paths (regex)
    location ~ ${POLARYON_API_REGEX} {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # /api/ catch-all -> HA
    location /api/ {
        proxy_pass http://127.0.0.1:8123;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header Accept-Encoding "";
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # HA entry point
    location /hass-${HA_SECRET}/ {
        proxy_pass http://127.0.0.1:8123/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Encoding "";
        proxy_redirect / /hass-${HA_SECRET}/;
        sub_filter_types text/html application/manifest+json;
        sub_filter '/frontend_latest/' '/hass-${HA_SECRET}/frontend_latest/';
        sub_filter '/frontend_es5/' '/hass-${HA_SECRET}/frontend_es5/';
        sub_filter '/static/' '/hass-${HA_SECRET}/static/';
        sub_filter '/manifest.json' '/hass-${HA_SECRET}/manifest.json';
        sub_filter '/api/onboarding' '/hass-${HA_SECRET}/api/onboarding';
        sub_filter_once off;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/polaryon.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/polaryon.com.br/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
server {
    if ($host = www.polaryon.com.br) { return 301 https://$host$request_uri; }
    if ($host = polaryon.com.br) { return 301 https://$host$request_uri; }
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
        console.log('Nginx reloaded OK');
    }

    // Install Grafana Docker container
    console.log('\n=== Installing Grafana Docker ===');
    
    // Check if already running
    const existing = await exec('docker ps --filter name=grafana --format "{{.Names}}" 2>&1');
    if (existing.includes('grafana')) {
        console.log('Grafana already running, restarting...');
        await exec('docker rm -f grafana 2>&1');
    }

    // Create directories
    await exec('mkdir -p /opt/grafana/data 2>&1');
    await exec('mkdir -p /opt/grafana/config 2>&1');

    // Run Grafana
    const install = await exec(`docker run -d \\
        --name grafana \\
        --restart unless-stopped \\
        -p 127.0.0.1:3001:3000 \\
        -v /opt/grafana/data:/var/lib/grafana \\
        -e "GF_SERVER_ROOT_URL=https://polaryon.com.br/grafana-${GRAFANA_SECRET}/" \\
        -e "GF_SERVER_SERVE_FROM_SUB_PATH=true" \\
        grafana/grafana:latest 2>&1`);
    console.log('Docker run:', install);

    // Wait for startup
    await new Promise(r => setTimeout(r, 5000));
    
    // Check status
    const status = await exec('docker ps --filter name=grafana --format "{{.Names}} {{.Status}}"');
    console.log('Status:', status);
    
    // Test access
    console.log('\n=== Verificacoes ===');
    const tests = [
        ['/api/health', 'Polaryon API'],
        ['/hass-xxx/', 'HA entry'],
        ['/home/overview', 'HA /home redirect'],
        ['/grafana-xxx/login', 'Grafana'],
    ];
    for (const [path, label] of tests) {
        const url = path.replace('hass-xxx', 'hass-' + HA_SECRET).replace('grafana-xxx', 'grafana-' + GRAFANA_SECRET);
        const code = await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br" + url + " 2>&1");
        console.log(`  ${label.padEnd(20)} ${code}`);
    }

    console.log(`\n✅ Grafana: https://polaryon.com.br/grafana-${GRAFANA_SECRET}/`);
    console.log(`✅ HA: https://polaryon.com.br/hass-${HA_SECRET}/`);

    conn.end();
})();
