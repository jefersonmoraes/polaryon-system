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

    // Test HA with each header individually to find the culprit
    console.log('=== HA with no headers ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8123/"));
    
    console.log('\n=== HA with X-Forwarded-Proto: https ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' -H 'X-Forwarded-Proto: https' http://127.0.0.1:8123/"));
    
    console.log('\n=== HA with X-Forwarded-For: 127.0.0.1 ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' -H 'X-Forwarded-For: 127.0.0.1' http://127.0.0.1:8123/"));
    
    console.log('\n=== HA with Host: 127.0.0.1:8123 ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' -H 'Host: 127.0.0.1:8123' http://127.0.0.1:8123/"));
    
    console.log('\n=== HA with proxy-connection header ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' -H 'Proxy-Connection: close' http://127.0.0.1:8123/"));

    // Check: what headers does nginx actually send via proxy?
    console.log('\n=== Echo endpoint test ===');
    // Use nginx's own echo to see what headers are sent
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' -H 'Custom-Test: 123' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | grep -i 'content-type\\|server\\|http/'"));
    
    // Full HA direct with all headers
    console.log('\n=== HA with ALL headers ===');
    console.log(await exec("curl -s -D - --max-time 5 -H 'Host: 127.0.0.1:8123' -H 'X-Forwarded-For: 127.0.0.1' -H 'X-Forwarded-Proto: https' -H 'Connection: keep-alive' -H 'Accept: */*' http://127.0.0.1:8123/ 2>&1 | head -15"));

    conn.end();
})();
