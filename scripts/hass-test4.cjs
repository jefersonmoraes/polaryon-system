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

    console.log('=== Via HTTPS (localhost:443) ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 -k https://localhost/hass-" + SECRET + "/ 2>&1 | head -15"));

    console.log('\n=== Via HTTPS + Host header ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 -k -H 'Host: polaryon.com.br' https://localhost/hass-" + SECRET + "/ 2>&1 | head -15"));
    
    console.log('\n=== Verificando config atual do HA location ===');
    console.log(await exec("sed -n '/Home Assistant/,/^    }/p' /etc/nginx/sites-enabled/default"));

    conn.end();
})();
