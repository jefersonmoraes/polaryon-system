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

    // Test real domain from VPS
    console.log('=== Via real domain HTTPS ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 10 https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -15"));

    // Also test access log
    console.log('\n=== Nginx access log (last 5) ===');
    console.log(await exec("tail -5 /var/log/nginx/access.log"));

    // Also test error log
    console.log('\n=== Nginx error log (last 5) ===');
    console.log(await exec("tail -5 /var/log/nginx/error.log"));

    conn.end();
})();
