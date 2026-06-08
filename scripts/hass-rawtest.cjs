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

    // Simple test: what happens with HTTPS to a path that only exists in our server block?
    // If the server block is matched, ANY path should be handled
    // If the server block is NOT matched, it goes to default which returns 400 for SSL
    
    // Let's also check what server_name our SSL server uses
    console.log('=== Full nginx config for HTTPS server ===');
    console.log(await exec("sed -n '/listen 443 ssl/,/^}/p' /etc/nginx/sites-enabled/default"));

    // Try the request with TLS SNI hint
    console.log('\n=== With --resolve AND explicit --header Host ===');
    const cmd = "curl -v -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' -H 'Host: polaryon.com.br' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1";
    console.log(await exec(cmd));

    conn.end();
})();
