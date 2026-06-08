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
    
    console.log('=== Host headers in config ===');
    console.log(await exec("grep -n 'proxy_set_header Host' /etc/nginx/sites-enabled/default"));
    
    console.log('\n=== HA location block ===');
    console.log(await exec("sed -n '/Home Assistant/,/^    }/p' /etc/nginx/sites-enabled/default"));

    conn.end();
})();
