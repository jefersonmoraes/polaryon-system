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

    // Fix HA location: remove X-Forwarded-For and X-Forwarded-Proto
    // HA doesn't need trusted proxies config for this to work
    await exec("sed -i '/Home Assistant/,/^    }/s/proxy_set_header X-Forwarded-.*//' /etc/nginx/sites-enabled/default");

    // Remove empty lines from HA block
    await exec("sed -i '/^[[:space:]]*$/d' /etc/nginx/sites-enabled/default");

    const test = await exec('nginx -t 2>&1');
    console.log('Nginx test:', test);
    if (test.includes('successful') || test.includes('ok')) {
        await exec('systemctl reload nginx 2>&1');
        console.log('Reloaded');
    }

    // Check HA location
    console.log('\n=== HA location ===');
    console.log(await exec("sed -n '/Home Assistant/,/^    }/p' /etc/nginx/sites-enabled/default"));

    // Test HA
    console.log('\n=== HA via proxy ===');
    console.log(await exec("curl -s -D - --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -10"));
    console.log('\n=== HA body ===');
    console.log(await exec("curl -s --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -c 300"));

    // Test with follow redirect
    console.log('\n=== HA with follow redirect ===');
    console.log(await exec("curl -sL --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -c 500"));

    // Verify Polaryon still works
    console.log('\n=== Polaryon check ===');
    console.log(await exec("curl -s -o /dev/null -w 'API: %{http_code}, SPA: ' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/ 2>&1"));

    conn.end();
})();
