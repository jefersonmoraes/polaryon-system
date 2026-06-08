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

    // 1. Read current nginx config
    console.log('=== CURRENT NGINX CONFIG ===');
    const conf = await exec("cat /etc/nginx/sites-enabled/default | head -120");
    console.log(conf);

    // 2. Check manifest.json content via hass-xxx (should have sub_filter)
    console.log('\n=== REWRITTEN MANIFEST (/hass-xxx/manifest.json) ===');
    const manifest = await exec("curl -sL --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/manifest.json 2>&1");
    // Check if icons paths have hass-xxx prefix
    const iconPaths = manifest.match(/"src":"[^"]+"/g) || [];
    iconPaths.forEach(p => {
        const hasPrefix = p.includes(SECRET);
        console.log('  ' + (hasPrefix ? '✅' : '❌') + ' ' + p);
    });

    // 3. Check original onboarding.js line 88 for regex error
    console.log('\n=== ORIGINAL JS (no sub_filter) - line 80-96 ===');
    const js = await exec("curl -sL --max-time 15 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1");
    const lines = js.split('\n');
    for (let i = 79; i <= 95 && i < lines.length; i++) {
        console.log(`    ${i+1}: ${lines[i].substring(0, 120)}`);
    }
    
    // 4. Check if there are regex issues in the original JS
    console.log('\n=== Regex patterns in JS ===');
    const regexLikes = js.match(/\/(?:[^\/\\]|\\.)+\/[gimsuy]*/g) || [];
    const suspicious = regexLikes.filter(r => r.includes('api') || r.includes('static'));
    if (suspicious.length > 0) {
        console.log('Regex-like patterns containing api/static:');
        suspicious.forEach(r => console.log('  ' + r.substring(0, 80)));
    } else {
        console.log('No suspicious regex patterns found');
    }

    // 5. Check actual HA internal routes
    console.log('\n=== HA internal route checks ===');
    console.log('/api/brands/integration: ' + await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8123/api/brands/integration 2>&1"));
    console.log('/api/brands/hardware: ' + await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8123/api/brands/hardware 2>&1"));
    // Try with query params
    console.log('/api/brands/integration/homeassistant: ' + await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 'http://127.0.0.1:8123/api/brands/integration/homeassistant' 2>&1"));

    conn.end();
})();
