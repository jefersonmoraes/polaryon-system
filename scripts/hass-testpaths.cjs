const { Client } = require('ssh2');
const conn = new Client();
const VPS = { host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 };
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

    // Test polaryon.com.br root (SPA)
    console.log('=== HTTPS root (SPA) ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/ 2>&1 | head -10"));

    // Test a normal path that should return SPA index.html
    console.log('\n=== HTTPS /some-random-path (SPA fallback) ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/some-random-path 2>&1 | head -10"));

    // Test HA
    console.log('\n=== HTTPS /hass-xxx/ ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + require('crypto').randomBytes(16).toString('hex') + "/ 2>&1 | head -10"));

    // Maybe the issue is the path? Let me test just /hass- (without the full hash)
    console.log('\n=== HTTPS /hass-4d151307e73ccfb9b7b84ff31e9a2f6c (no trailing slash) ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-4d151307e73ccfb9b7b84ff31e9a2f6c 2>&1 | head -10"));

    conn.end();
})();
