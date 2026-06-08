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

    // Browser simulation: proper Host header + follow redirects
    console.log('=== Browser simulation ===');
    const r = await exec("curl -sL -D - --max-time 10 -H 'Host: polaryon.com.br' -A 'Mozilla/5.0' --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -30");
    console.log(r);

    // Also try HTTP directly with proper Host (will redirect)
    console.log('\n=== Via HTTP (should redirect to HTTPS) ===');
    const r2 = await exec("curl -sL -D - --max-time 10 -H 'Host: polaryon.com.br' http://localhost/hass-" + SECRET + "/ 2>&1 | head -30");
    console.log(r2);

    // Cleanup
    await exec('rm -f /tmp/hass-*.py');
    conn.end();
})();
