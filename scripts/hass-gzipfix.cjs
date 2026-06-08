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

    // First: check if nginx sees gzip Accept-Encoding
    console.log('=== Gzip diagnostic ===');
    
    // Test 1: HA direct (unproxied) - is HA itself gzipping?
    console.log('Test 1: HA direct, no AE header:');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 http://127.0.0.1:8123/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1 | grep -i 'content-encoding\\|content-type'"));
    
    console.log('Test 2: HA direct, AE=gzip:');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 -H 'Accept-Encoding: gzip' http://127.0.0.1:8123/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1 | grep -i 'content-encoding\\|content-type'"));

    // Test 3: Via nginx proxy, no AE
    console.log('Test 3: Via nginx, no AE:');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1 | grep -i 'content-encoding\\|content-type'"));

    // Test 4: Via nginx, with explicit no gzip
    console.log('Test 4: Via nginx, AE: identity');
    const resp = await exec("curl -s -D - -o /tmp/hass-test-js.txt --max-time 5 -H 'Accept-Encoding: identity' --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1 | grep -i 'content-encoding\\|content-type'");
    console.log(resp);

    // Check what HA sends
    console.log('\n=== HA response headers (direct, full) ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 http://127.0.0.1:8123/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1 | head -20"));

    // Fix: add proxy_set_header Accept-Encoding "" and verify sub_filter works
    console.log('\n=== Applying fix: Accept-Encoding "" + explicit sub_filter_types ===');
    
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
    # Home Assistant API (exact match before /api/ to avoid conflict)
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
    # Home Assistant - UNICO location para todo o conteudo
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
        sub_filter_types text/html text/javascript application/javascript text/css application/json;
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

    // RE-TEST: check if sub_filter is actually being applied
    console.log('\n=== POST-FIX VERIFICATION ===');
    
    // Check no gzip
    console.log('Gzip check:');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 -H 'Accept-Encoding: gzip' --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1 | grep -i 'content-encoding'") || '  not gzipped');
    
    // Check paths in JS
    const js = await exec("curl -sL --max-time 15 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1");
    const absPaths = js.match(/["'`]\/[^"'`]*["'`]/g) || [];
    const haPaths = absPaths.filter(p => /frontend|static|api|manifest/.test(p));
    let broken = 0;
    haPaths.forEach(p => {
        const hasPrefix = p.includes(SECRET);
        if (!hasPrefix) { broken++; console.log('  ❌', p); }
    });
    if (broken === 0) {
        console.log(`✅ TODOS os ${haPaths.length} paths rewritados`);
    } else {
        console.log(`❌ ${broken}/${haPaths.length} paths quebrados`);
    }

    conn.end();
})();
