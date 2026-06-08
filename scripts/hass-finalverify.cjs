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

    // Final verification
    console.log('=== HA redirect target ===');
    console.log(await exec("curl -s -o /dev/null -w 'Status: %{http_code}\\nFinal URL: %{url_effective}\\n' --max-time 10 -L --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/"));

    // Verify Polaryon intact
    console.log('\n=== Polaryon API ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/api/health"));

    console.log('\n=== Polaryon SPA ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/"));

    // Cleanup temp scripts
    await exec("rm -f /tmp/hass-*.py /tmp/fix*.py");

    // Verify nginx config
    console.log('\n=== Nginx config sanity ===');
    console.log(await exec("grep -c 'proxy_set_header Host \\$host' /etc/nginx/sites-enabled/default"));
    console.log(await exec("nginx -t 2>&1"));

    console.log('\n✅ TUDO PRONTO!');
    console.log('https://polaryon.com.br/hass-' + SECRET + '/');
    conn.end();
})();
