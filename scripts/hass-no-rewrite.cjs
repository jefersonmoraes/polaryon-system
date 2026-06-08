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

    // Check the nginx access and error logs for details of 400
    console.log('=== Trigger 400 ===');
    await exec("curl -s -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/");
    
    console.log('=== Error log ===');
    console.log(await exec("tail -20 /var/log/nginx/error.log"));
    console.log('=== Access log ===');
    console.log(await exec("tail -5 /var/log/nginx/access.log"));

    // Try to check if the issue is the rewrite
    // Temporarily remove rewrite and test
    console.log('\n=== Test WITHOUT rewrite ===');
    await exec("sed -i 's/rewrite.*break;//' /etc/nginx/sites-enabled/default");
    await exec("nginx -t 2>&1 && systemctl reload nginx");
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -10"));

    // Restore rewrite
    await exec("sed -i 's|proxy_pass http://127.0.0.1:8123;|rewrite ^/hass-" + SECRET + "/(.*) /$1 break;\n        proxy_pass http://127.0.0.1:8123;|' /etc/nginx/sites-enabled/default");
    await exec("nginx -t 2>&1 && systemctl reload nginx");

    // Test if HA responds when we send a proper request directly
    console.log('\n=== HA direct proxy test ===');
    console.log(await exec("curl -s -D - --max-time 5 http://127.0.0.1:8123/hass-" + SECRET + "/ 2>&1 | head -10"));

    conn.end();
})();
