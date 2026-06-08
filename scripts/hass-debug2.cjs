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

    // Check current HA location in config
    console.log('=== HA location block ===');
    console.log(await exec("sed -n '/Home Assistant/,/^    }/p' /etc/nginx/sites-enabled/default"));

    // Check the EXACT line of the proxy_pass
    console.log('\n=== proxy_pass line ===');
    console.log(await exec("grep -n 'proxy_pass.*8123' /etc/nginx/sites-enabled/default"));

    // Let's see what HA returns when we call it with the same headers nginx would use
    console.log('\n=== HA with same headers nginx sends ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 -H 'Host: polaryon.com.br' -H 'X-Forwarded-For: 127.0.0.1' -H 'X-Forwarded-Proto: https' http://127.0.0.1:8123/ 2>&1 | head -15"));

    // Test with no special headers
    console.log('\n=== HA with no headers ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8123/ 2>&1"));

    conn.end();
})();
