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

    // Test against 443 directly with -k (insecure) to skip cert issues
    console.log('=== HA via HTTPS ===');
    console.log(await exec("curl -sLk -D - --max-time 10 -H 'Host: polaryon.com.br' https://localhost/hass-" + SECRET + "/ 2>&1 | head -30"));
    
    // Also test what HA's onboarding page looks like
    console.log('\n=== HA onboarding page content ===');
    console.log(await exec("curl -sLk --max-time 10 -H 'Host: polaryon.com.br' https://localhost/hass-" + SECRET + "/ 2>&1 | head -50"));

    // Check HA onboarding URL
    console.log('\n=== HA redirect check ===');
    console.log(await exec("curl -s -o /dev/null -w 'HTTP %{http_code}\\nRedirect: %{redirect_url}\\n' -H 'Host: polaryon.com.br' http://localhost/hass-" + SECRET + "/"));

    conn.end();
})();
