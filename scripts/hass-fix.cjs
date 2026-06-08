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

    // Write Python script to VPS
    const pycode = `
import re
with open('/etc/nginx/sites-enabled/default', 'r') as f:
    lines = f.readlines()

# Remove any existing HA location block (lines containing "Home Assistant")
lines = [l for l in lines if 'Home Assistant' not in l and 'hass-' not in l or 'proxy_pass' in l]

# Find the HTTPS server block (has listen 443) and insert HA block before its closing }
https_end = -1
in_https = False
for i, line in enumerate(lines):
    if 'listen 443 ssl' in line:
        in_https = True
    if in_https and line.strip() == '}':
        https_end = i
        break

if https_end > 0:
    block = [
        '    # Home Assistant (acesso secreto)\n',
        '    location /hass-' + '${SECRET}' + '/ {\n',
        '        rewrite ^/hass-' + '${SECRET}' + '/(.*) /$1 break;\n',
        '        proxy_pass http://127.0.0.1:8123;\n',
        '        proxy_set_header Host $host;\n',
        '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n',
        '        proxy_set_header X-Forwarded-Proto $scheme;\n',
        '        proxy_http_version 1.1;\n',
        '        proxy_set_header Upgrade $http_upgrade;\n',
        '        proxy_set_header Connection "upgrade";\n',
        '    }\n',
    ]
    lines[https_end:https_end] = block

with open('/etc/nginx/sites-enabled/default', 'w') as f:
    f.writelines(lines)
print('OK')
`;
    const b64 = Buffer.from(pycode).toString('base64');
    await exec('echo ' + b64 + ' | base64 -d > /tmp/fix-hass.py');
    
    const result = await exec('python3 /tmp/fix-hass.py 2>&1');
    console.log('Python:', result);

    // Test
    const test = await exec('nginx -t 2>&1');
    console.log('Nginx test:', test);
    if (test.includes('successful') || test.includes('ok')) {
        await exec('systemctl reload nginx 2>&1');
        console.log('Reloaded');
    }

    // Test HA via nginx
    console.log('\n=== Teste HA via proxy ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' -H 'Host: polaryon.com.br' --max-time 5 http://localhost/hass-" + SECRET + "/"));

    // Verify final config
    console.log('\n=== CONFIG FINAL ===');
    console.log(await exec("grep -n 'Home Assistant\\|hass-\\|listen' /etc/nginx/sites-enabled/default"));

    await exec('rm -f /tmp/fix-hass.py');
    conn.end();
})();
