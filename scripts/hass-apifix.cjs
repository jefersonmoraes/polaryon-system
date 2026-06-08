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

    // Read current config, add needed locations via Python
    const pycode = `
with open('/etc/nginx/sites-enabled/default') as f:
    content = f.read()

# Add exact match for /api/onboarding -> HA (before /api/ block)
api_onboarding = """    # Home Assistant API (onboarding)
    location = /api/onboarding {
        proxy_pass http://127.0.0.1:8123/api/onboarding;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
    }

"""
content = content.replace('location /api/ {', api_onboarding + 'location /api/ {')

# Add sub_filter to static file locations
old_static = """    location /hass-${SECRET}/static/ {
        proxy_pass http://127.0.0.1:8123/static/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
    }"""

new_static = """    location /hass-${SECRET}/static/ {
        proxy_pass http://127.0.0.1:8123/static/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        sub_filter_types text/javascript application/javascript text/css;
        sub_filter '/api/onboarding' '/hass-${SECRET}/api/onboarding';
        sub_filter_once off;
    }"""

content = content.replace(old_static, new_static)

# Also add sub_filter to frontend_latest location for JS files
old_front = """    location /hass-${SECRET}/frontend_latest/ {
        proxy_pass http://127.0.0.1:8123/frontend_latest/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
    }"""

new_front = """    location /hass-${SECRET}/frontend_latest/ {
        proxy_pass http://127.0.0.1:8123/frontend_latest/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8123;
        sub_filter_types text/javascript application/javascript;
        sub_filter '/api/onboarding' '/hass-${SECRET}/api/onboarding';
        sub_filter_once off;
    }"""

content = content.replace(old_front, new_front)

with open('/etc/nginx/sites-enabled/default', 'w') as f:
    f.write(content)
print('OK')
`;
    const b64 = Buffer.from(pycode).toString('base64');
    await exec('echo ' + b64 + ' | base64 -d > /tmp/hass-apifix.py');
    
    const result = await exec('python3 /tmp/hass-apifix.py 2>&1');
    console.log('Python:', result);

    const test = await exec('nginx -t 2>&1');
    console.log('Nginx test:', test);
    if (test.includes('successful') || test.includes('ok')) {
        await exec('systemctl reload nginx 2>&1');
        console.log('Reloaded');
    }

    // Show relevant config
    console.log('\n=== HA locations ===');
    console.log(await exec("grep -n 'api/onboarding\\|static/\\|frontend_latest\\|sub_filter' /etc/nginx/sites-enabled/default"));

    // Test API onboarding
    console.log('\n=== /api/onboarding ===');
    console.log(await exec("curl -s -o /dev/null -w 'HTTP %{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/api/onboarding"));

    // Verify Polaryon API still works
    console.log('\n=== Polaryon api/health ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/api/health"));

    // Test HA page
    console.log('\n=== HA page (check reescrita de paths) ===');
    const page = await exec("curl -s --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | grep -oE '/hass-[a-z0-9]+/[a-z./-]+' | head -5");
    console.log(page);

    await exec('rm -f /tmp/hass-*.py');
    conn.end();
})();
