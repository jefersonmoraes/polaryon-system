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

    // Full verbose test to see what HA returns
    console.log('=== HA response headers ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 http://localhost:8123/ 2>&1 | head -20"));

    console.log('\n=== Via proxy (follow redirects) ===');
    console.log(await exec("curl -sL -D - --max-time 10 http://localhost/hass-" + SECRET + "/ 2>&1 | head -30"));

    console.log('\n=== Via proxy NO FOLLOW (check redirect URL) ===');
    console.log(await exec("curl -s -o /dev/null -w 'HTTP %{http_code}\\nRedirect: %{redirect_url}\\n' --max-time 5 http://localhost/hass-" + SECRET + "/"));

    console.log('\n=== Check what HA redirects to when Host header is set ===');
    console.log(await exec("curl -s -o /dev/null -w 'HTTP %{http_code}\\nRedirect: %{redirect_url}\\n' -H 'Host: polaryon.com.br' --max-time 5 http://localhost/hass-" + SECRET + "/"));

    conn.end();
})();
