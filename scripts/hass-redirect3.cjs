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

    // Add proxy_redirect to HA location
    const pycode = `
with open('/etc/nginx/sites-enabled/default') as f:
    content = f.read()

block = """    # Home Assistant (acesso secreto)
    location /hass-${SECRET}/ {
        proxy_pass http://127.0.0.1:8123/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_redirect / /hass-${SECRET}/;
    }"""

old = open('/etc/nginx/sites-enabled/default').read()
# Find current HA block and replace
import re
pattern = r'# Home Assistant.*?location /hass-.*?/ \\{[^}]+\\}'
new_block = """    # Home Assistant (acesso secreto)
    location /hass-${SECRET}/ {
        proxy_pass http://127.0.0.1:8123/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        proxy_redirect / /hass-${SECRET}/;
    }"""
old = re.sub(pattern, new_block, old, flags=re.DOTALL)
with open('/etc/nginx/sites-enabled/default', 'w') as f:
    f.write(old)
print('OK')
`;
    const b64 = Buffer.from(pycode).toString('base64');
    await exec('echo ' + b64 + ' | base64 -d > /tmp/hass-redirect2.py');
    
    const result = await exec('python3 /tmp/hass-redirect2.py 2>&1');
    console.log('Python:', result);

    const test = await exec('nginx -t 2>&1');
    console.log('Nginx test:', test);
    if (test.includes('successful') || test.includes('ok')) {
        await exec('systemctl reload nginx 2>&1');
        console.log('Reloaded');
    }

    // Check HA location
    console.log('\n=== HA location ===');
    console.log(await exec("sed -n '/Home Assistant/,/^    }/p' /etc/nginx/sites-enabled/default"));

    // Test HA with follow redirect
    console.log('\n=== HA with follow redirect ===');
    const r = await exec("curl -sL --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -c 500");
    console.log(r);

    // Check final status of redirect
    console.log('\n=== HA redirect target ===');
    console.log(await exec("curl -s -o /dev/null -w 'Status: %{http_code}\\nFinal URL: %{url_effective}\\n' --max-time 10 -L --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/"));

    conn.end();
})();
