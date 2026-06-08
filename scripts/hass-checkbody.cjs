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

    // Quick test: does the proxy actually forward to HA?
    // Let's check by seeing if the HTML body contains "Home Assistant"
    console.log('=== HA direct response body (first 200 chars) ===');
    const haBody = await exec("curl -sL --max-time 10 http://127.0.0.1:8123/ 2>&1");
    console.log(haBody.substring(0, 200));
    
    console.log('\n=== SPA index.html body (first 200 chars) ===');
    const spaBody = await exec("curl -sL --max-time 10 -H 'Host: polaryon.com.br' http://localhost/hass-" + SECRET + "/ 2>&1 | head -c 200");
    console.log(spaBody);

    // Let's test what the proxy RETURNS by checking content type
    console.log('\n=== Content-Type check ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 http://127.0.0.1:8123/ 2>&1 | grep -i content-type"));
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 -H 'Host: polaryon.com.br' http://localhost/hass-" + SECRET + "/ 2>&1 | grep -i content-type"));

    conn.end();
})();
