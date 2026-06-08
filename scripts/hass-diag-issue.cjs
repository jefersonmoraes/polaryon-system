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

    // 1. Check if sub_filter module is compiled
    console.log('=== nginx modules ===');
    console.log(await exec("nginx -V 2>&1 | tr ' ' '\\n' | grep -i 'sub\\|filter'"));

    // 2. Check what the REAL urls look like when HA returns the onboarding HTML
    console.log('\n=== Headers da resposta HA proxied ===');
    console.log(await exec("curl -s -D - --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/onboarding.html 2>&1 | head -15"));

    // 3. Check content-type of the response
    console.log('\n=== Content-Type do onboarding ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/onboarding.html 2>&1 | grep -i content-type"));

    // 4. Check if the JS is served correctly
    console.log('\n=== JS module content-type ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1 | grep -i content-type"));

    // 5. Check if /frontend_latest/ at root serves HA or SPA
    console.log('\n=== /frontend_latest/ (sem prefixo) ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1 | head -10"));

    // 6. Check if manifest.json is served correctly
    console.log('\n=== /hass-xxx/manifest.json ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/manifest.json 2>&1 | head -10"));

    conn.end();
})();
