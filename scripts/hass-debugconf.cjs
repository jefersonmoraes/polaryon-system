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

    // Check what Let's Encrypt SSL config contains
    console.log('=== options-ssl-nginx.conf ===');
    console.log(await exec("cat /etc/letsencrypt/options-ssl-nginx.conf"));

    // Check if there's another default nginx config interfering
    console.log('\n=== All nginx configs ===');
    console.log(await exec("ls -la /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>&1"));

    // Check the full compiled config
    console.log('\n=== Full compiled config (first 100 lines) ===');
    console.log(await exec("nginx -T 2>&1 | head -100"));

    conn.end();
})();
