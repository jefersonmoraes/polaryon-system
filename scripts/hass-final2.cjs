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

    // Write the COMPLETE correct config
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
    if (test.includes('successful') || test.includes('ok')) {
        await exec('systemctl reload nginx 2>&1');
        console.log('Reloaded');
    }

    // Test Polaryon first!
    console.log('\n=== Polaryon API ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/api/health 2>&1"));

    // Test SPA
    console.log('\n=== Polaryon SPA ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/ 2>&1"));

    // Test HA!
    console.log('\n=== Home Assistant ===');
    console.log(await exec("curl -s -D - --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -10"));
    console.log('\n=== HA body ===');
    console.log(await exec("curl -s --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -c 200"));

    conn.end();
})();
