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

    // Try with verbose output
    console.log('=== curl verbose to localhost:443 ===');
    console.log(await exec("curl -v -k --max-time 5 https://localhost/hass-" + SECRET + "/ 2>&1 | head -20"));

    // Also try with http2 disabled
    console.log('\n=== curl with --http1.1 ===');
    console.log(await exec("curl -v -k --http1.1 --max-time 5 https://localhost/hass-" + SECRET + "/ 2>&1 | head -20"));

    // Check if there's an SNI issue
    console.log('\n=== curl with --resolve ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -15"));

    conn.end();
})();
