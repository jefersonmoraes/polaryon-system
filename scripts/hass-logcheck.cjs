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

    // Trigger a 400 request
    await exec("curl -s -o /dev/null --max-time 5 -H 'Host: polaryon.com.br' --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/");
    
    // Now check error log
    console.log('=== Access log ===');
    console.log(await exec("tail -3 /var/log/nginx/access.log"));

    console.log('\n=== Error log ===');
    console.log(await exec("tail -10 /var/log/nginx/error.log"));

    // Also check if maybe the issue is that nginx can't find the server block
    console.log('\n=== Nginx server blocks ===');
    console.log(await exec("nginx -T 2>&1 | grep -A3 'server_name\\|listen' | head -30"));

    conn.end();
})();
