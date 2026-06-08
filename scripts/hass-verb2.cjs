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

    // Show verbose output including the HTTP response
    console.log('=== Full verbose ===');
    const r = await exec("curl -v -k --max-time 10 https://localhost/hass-" + SECRET + "/ 2>&1");
    // Show everything after "CERT verify"
    const idx = r.indexOf('CERT verify');
    console.log(r.substring(idx));

    // Test the same URL that a browser would use
    console.log('\n=== Browser-like test ===');
    console.log(await exec("curl -s -D - --max-time 10 -H 'User-Agent: Mozilla/5.0' -H 'Accept: text/html' --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -20"));

    conn.end();
})();
