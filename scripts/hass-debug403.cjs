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

    // Test 1: Direct HA for static path
    console.log('=== Test: HA direct /static/icons/ ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 http://127.0.0.1:8123/static/icons/favicon-192x192.png 2>&1 | head -10"));

    // Test 2: Via nginx
    console.log('\n=== Test: nginx /static/icons/ ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/static/icons/favicon-192x192.png 2>&1 | head -10"));

    // Test 3: Check exact HA brand paths
    console.log('\n=== Test: HA brand paths ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 http://127.0.0.1:8123/api/brands/ 2>&1 | head -10"));
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 http://127.0.0.1:8123/api/brand/ 2>&1 | head -10"));

    // Test 4: Check filesystem - does Polaryon have /static/ dir?
    console.log('\n=== Filesystem /static/ ===');
    console.log(await exec("ls -la /var/www/polaryon/dist_electron/static/ 2>&1 || echo 'NO STATIC DIR'"));

    // Test 5: Check if / before /static/ is the issue - use curl -v to see which location handles it
    console.log('\n=== Verbose: nginx debug ===');
    const verbose = await exec("curl -s -D /tmp/hdr.txt -o /dev/null --max-time 5 -w '\\nHTTP: %{http_code}\\n' --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/static/icons/favicon-192x192.png 2>&1");
    console.log(verbose);
    const headers = await exec("cat /tmp/hdr.txt");
    console.log('Headers:', headers.substring(0, 500));

    // Test 6: Check on-disk for static dirs
    console.log('\n=== Check for 403 root cause ===');
    // Try statically via nginx root
    console.log(await exec("stat /var/www/polaryon/dist_electron/static/ 2>&1 || echo 'DIR NOT FOUND'"));

    conn.end();
})();
