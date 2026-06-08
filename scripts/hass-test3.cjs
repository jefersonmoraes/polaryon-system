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

    // Check HA direct
    console.log('=== HA direto porta 8123 ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8123/"));
    
    // Test proxy WITHOUT custom Host header  
    console.log('\n=== Proxy sem Host header ===');
    console.log(await exec("curl -sL -D - --max-time 10 http://localhost/hass-" + SECRET + "/ 2>&1 | head -20"));

    // Test proxy with correct Host for the server_name
    console.log('\n=== Proxy com Host: polaryon.com.br (sem follow) ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 -H 'Host: polaryon.com.br' http://localhost/hass-" + SECRET + "/ 2>&1 | head -15"));

    // Also test: what does the http->https redirect return?
    console.log('\n=== Apenas HTTP redirect check ===');
    console.log(await exec("curl -s -o /dev/null -w 'URL: %{redirect_url}\\nHTTP: %{http_code}\\n' -H 'Host: polaryon.com.br' http://localhost/hass-" + SECRET + "/"));

    conn.end();
})();
