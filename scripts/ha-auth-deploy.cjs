const { Client } = require('ssh2');
const c = new Client();
const HA_SECRET = '4d151307e73ccfb9b7b84ff31e9a2f6c';
c.on('ready', async () => {
  const x = (cmd) => new Promise((r) => {
    let o = '';
    c.exec(cmd, (e, s) => { s.on('data', d => o += d); s.on('close', () => r(o)); s.stderr.on('data', d => o += d); });
  });

  const POLARYON_API_REGEX = '^/api/(health|auth/(login|google|desktop-login|verify|register|set-cookie)|users|calendar|kanban|documents|certificates|accounting|audit|sidebar-links|connections|transparency|activity|maintenance|transferegov|bidding|backups|radar)($|/)';

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

    # HA WebSocket (no auth - WS handshake already validated by page auth)
    location /api/websocket {
        proxy_pass http://127.0.0.1:8123/api/websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host 127.0.0.1:8123;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Internal auth check for HA
    location /_hass-auth-check {
        internal;
        proxy_pass http://localhost:3000/api/auth/verify;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
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

    # /api/ catch-all -> HA (no auth, HA handles its own auth)
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

    # HA entry point (requires valid Polaryon session cookie)
    location /hass-${HA_SECRET}/ {
        auth_request /_hass-auth-check;
        auth_request_set $auth_status $upstream_status;
        error_page 401 = @hass-unauthorized;

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

    location @hass-unauthorized {
        return 302 /login?redirect=/hass-${HA_SECRET}/;
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
    console.log('Nginx reloaded OK');
  }

  // Also restart Polaryon backend to pick up auth.ts changes
  console.log('\n=== Restarting Polaryon backend ===');
  const restart = await x('pm2 restart polaryon-backend 2>&1');
  console.log('PM2 restart:', restart);

  // Verify
  await new Promise(r => setTimeout(r, 5000));
  for (const [path, label] of [
    ['/api/health', 'Polaryon API'],
    ['/hass-' + HA_SECRET + '/', 'HA (auth required)'],
  ]) {
    const code = await x("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br" + path);
    console.log(`  ${label.padEnd(25)} ${code}`);
  }

  c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
