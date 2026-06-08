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

    // Clear and trigger error
    console.log(await exec("journalctl -u nginx --no-pager -n 20 2>&1 | tail -20"));
    
    // Also what does HA return when called normally
    console.log('\n=== HA response body ===');
    console.log(await exec("curl -s --max-time 5 http://127.0.0.1:8123/ 2>&1 | head -5"));

    // Check if maybe the issue is proxy_redirect causing problems
    // Let me try without it temporarily
    console.log('\n=== Trying without proxy_redirect ===');
    await exec("sed -i '/proxy_redirect/d' /etc/nginx/sites-enabled/default");
    await exec("nginx -t 2>&1 && systemctl reload nginx");
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 -k https://localhost/hass-" + SECRET + "/ 2>&1 | head -10"));
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 -H 'Host: polaryon.com.br' http://localhost/hass-" + SECRET + "/ 2>&1 | head -10"));

    conn.end();
})();
