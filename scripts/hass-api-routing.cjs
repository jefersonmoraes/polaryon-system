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

    // Polaryon API path prefixes (regex alternation)
    const PREFIXES = [
        'health',
        'auth/(login|google|desktop-login|verify|register)',
        'users',
        'calendar',
        'kanban',
        'documents',
        'certificates',
        'accounting',
        'audit',
        'sidebar-links',
        'sidebar-links',
        'connections',
        'transparency',
        'activity',
        'maintenance',
        'transferegov',
        'bidding',
        'backups',
        'radar',
    ];
    const POLARYON_API_REGEX = '^/api/(' + PREFIXES.join('|') + ')($|/)';

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

    # HA redirect (307 preserva metodo HTTP)
    location /auth/ { return 307 /hass-${SECRET}$request_uri; }
    # HA SPA routes (redirect ao fazer refresh fora do prefixo)
    location ~ ^/(lovelace|states|config|logbook|history|map|energy|developer-tools|profile|media-browser|home)($|/) {
        return 307 /hass-${SECRET}$request_uri;
    }

    # No-op Service Worker
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

    # Polaryon API paths (regex: match known Polaryon prefixes)
    location ~ ${POLARYON_API_REGEX} {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Default /api/ goes to HA
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

    # HA entry point (sub_filter APENAS em HTML)
    location /hass-${SECRET}/ {
        proxy_pass http://127.0.0.1:8123/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Encoding "";
        proxy_redirect / /hass-${SECRET}/;
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
        console.log('Reloaded OK');
    }

    // Verify routing
    console.log('\n=== API Routing verification ===');
    const tests = [
        ['/api/health', 'Polaryon'],           // should go to 3000
        ['/api/auth/login', 'Polaryon'],       // should go to 3000
        ['/api/config/config_entries/flow', 'HA'], // should go to 8123
        ['/api/states', 'HA'],                 // should go to 8123
        ['/api/auth/providers', 'HA'],         // should go to 8123 (not in Polaryon list)
        ['/api/kanban/boards', 'Polaryon'],    // should go to 3000
        ['/api/transparency/pncp-consulta', 'Polaryon'], // should go to 3000
        ['/api/bidding/sessions', 'Polaryon'], // should go to 3000
        ['/api/radar/settings', 'Polaryon'],   // should go to 3000
        ['/', 'SPA'],
        ['/hass-xxx/', 'HA entry'],
    ];
    for (const [path, expected] of tests) {
        const url = path.replace('hass-xxx', 'hass-' + SECRET);
        const code = await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br" + url + " 2>&1");
        console.log(`  [${expected.padEnd(10)}] ${code.padEnd(4)} ${path}`);
    }

    conn.end();
})();
