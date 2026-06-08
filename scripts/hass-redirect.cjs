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

    // Update config: add proxy_redirect to the HA location
    // Use Python to find and modify just the HA location block
    const pycode = `with open('/etc/nginx/sites-enabled/default') as f: c = f.read()
# Add proxy_redirect after the proxy_pass line
old = 'proxy_pass http://127.0.0.1:8123;'
new = old + '\\n        proxy_redirect ~^(/.*)$ /hass-${SECRET}$1;'
if old in c and 'proxy_redirect' not in c:
    c = c.replace(old, new)
    with open('/etc/nginx/sites-enabled/default', 'w') as f: f.write(c)
    print('UPDATED')
else:
    print('NO CHANGE')
`;

    const b64 = Buffer.from(pycode).toString('base64');
    await exec('echo ' + b64 + ' | base64 -d > /tmp/hass-redirect.py');
    
    const result = await exec('python3 /tmp/hass-redirect.py 2>&1');
    console.log('Python:', result);

    const test = await exec('nginx -t 2>&1');
    console.log('Nginx test:', test);
    if (test.includes('successful') || test.includes('ok')) {
        await exec('systemctl reload nginx 2>&1');
        console.log('Reloaded');
    }

    // Test follow redirects
    console.log('\n=== HA proxy com follow redirect ===');
    console.log(await exec("curl -sL -D - --max-time 10 -H 'Host: polaryon.com.br' http://localhost/hass-" + SECRET + "/ 2>&1 | head -20"));

    conn.end();
})();
