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

    // Use Python to read, modify, and write the config properly
    const pycode = `
import re
with open('/etc/nginx/sites-enabled/default', 'r') as f:
    content = f.read()

# Remove any existing HA block
content = re.sub(r'\\s*# Home Assistant.*?\\n\\s*location /hass-.*?\\n(?:.*?\\n)*?\\s*\\}\\n', '\\n', content, flags=re.DOTALL)
content = re.sub(r'\\s*# Home Assistant.*?\\n(?:.*?\\n)*?\\s*\\}\\n', '\\n', content, flags=re.DOTALL)

# Insert HA block before the closing brace of the HTTPS server block (the one after listen 443 ssl)
# Find the first 'listen 443 ssl' and then find its matching closing brace
ha_block = '''
    # Home Assistant (acesso secreto)
    location /hass-${SECRET}/ {
        rewrite ^/hass-${SECRET}/(.*) /$1 break;
        proxy_pass http://127.0.0.1:8123;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
'''

# Insert before the LAST closing brace (should be the HTTPS server block's closing brace)
idx = content.rfind('}')
if idx > 0:
    content = content[:idx] + ha_block + '\\n' + content[idx:]

with open('/etc/nginx/sites-enabled/default', 'w') as f:
    f.write(content)
print('OK')
`;

    // Write and execute
    const b64 = Buffer.from(pycode).toString('base64');
    await exec('echo ' + b64 + ' | base64 -d > /tmp/fix2.py');
    
    const result = await exec('python3 /tmp/fix2.py 2>&1');
    console.log('Python:', result);

    // Verify
    const conf = await exec("cat -n /etc/nginx/sites-enabled/default");
    console.log(conf);

    // Test
    const test = await exec('nginx -t 2>&1');
    console.log('Nginx test:', test);
    if (test.includes('successful') || test.includes('ok')) {
        await exec('systemctl reload nginx 2>&1');
        console.log('Reloaded OK');
    }

    // Test HA
    console.log('\n=== HA via proxy ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' -H 'Host: polaryon.com.br' --max-time 5 http://localhost/hass-" + SECRET + "/"));
    console.log('\n=== Polaryon via proxy ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' -H 'Host: polaryon.com.br' --max-time 5 http://localhost/"));

    await exec('rm -f /tmp/fix2.py');
    conn.end();
})();
