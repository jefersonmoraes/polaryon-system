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

    // Replace Host header in HA location
    await exec("sed -i 's/proxy_set_header Host \\$host;/proxy_set_header Host 127.0.0.1:8123;/' /etc/nginx/sites-enabled/default");
    
    const test = await exec('nginx -t 2>&1');
    console.log('Nginx test:', test);
    if (test.includes('successful') || test.includes('ok')) {
        await exec('systemctl reload nginx 2>&1');
        console.log('Reloaded');
    }

    // Test HA via proxy
    console.log('\n=== HA via proxy ===');
    const r = await exec("curl -s -D - --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1");
    console.log(r.substring(0, 500));

    // HA body
    console.log('\n=== HA body ===');
    const body = await exec("curl -s --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -c 300");
    console.log(body);

    // Test with follow redirect
    console.log('\n=== HA with follow redirect ===');
    console.log(await exec("curl -sL -D - --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -30"));

    conn.end();
})();
