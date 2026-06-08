const { Client } = require('ssh2');
const fs = require('fs');
const c = new Client();
const HA_SECRET = '4d151307e73ccfb9b7b84ff31e9a2f6c';
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  // Upload reverted files
  for (const [local, remote] of [
    ['E:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\src\\store\\auth-store.ts', '/var/www/polaryon/src/store/auth-store.ts'],
    ['E:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\src\\pages\\LoginPage.tsx', '/var/www/polaryon/src/pages/LoginPage.tsx'],
    ['E:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\backend\\src\\routes\\auth.ts', '/var/www/polaryon/backend/src/routes/auth.ts'],
    ['E:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\backend\\src\\middleware\\auth-middleware.ts', '/var/www/polaryon/backend/src/middleware/auth-middleware.ts'],
  ]) {
    const content = fs.readFileSync(local, 'utf8');
    const b64 = Buffer.from(content).toString('base64');
    await x('echo ' + b64 + ' | base64 -d > ' + remote);
    console.log('Uploaded', remote.split('/').pop());
  }

  // Rebuild backend
  console.log('\nBuilding backend...');
  console.log(await x('cd /var/www/polaryon/backend && npm run build 2>&1'));
  await x('pm2 restart polaryon-backend 2>&1');

  // Rebuild frontend
  console.log('\nBuilding frontend...');
  console.log(await x('cd /var/www/polaryon && npm run build 2>&1 | tail -3'));

  // Update nginx - remove auth_request and set-cookie endpoint from config
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
  await x('echo ' + b64 + ' | base64 -d > /etc/nginx/sites-enabled/default');
  const test = await x('nginx -t 2>&1');
  console.log('Nginx test:', test);
  if (test.includes('successful')) {
    await x('systemctl reload nginx 2>&1');
    console.log('Nginx reloaded');
  }

  // Verify
  const code = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' 'https://polaryon.com.br/hass-" + HA_SECRET + "/'");
  console.log('\nHA access:', code, '(should be 200)');

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:180000});
