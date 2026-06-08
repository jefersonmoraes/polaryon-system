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

    // 1. Check current nginx config for /frontend_latest/ location
    console.log('=== Current /frontend_latest/ location ===');
    const conf = await exec("grep -A 12 'location /frontend_latest/' /etc/nginx/sites-enabled/default");
    console.log(conf);

    // 2. Verify the authorize.js directly via nginx proxy (simulates browser)
    console.log('\n=== Browser-simulated request ===');
    const headers = [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept: */*',
        'Accept-Encoding: gzip, deflate, br',
        'Accept-Language: pt-BR,pt;q=0.9,en;q=0.8',
        'Referer: https://polaryon.com.br/auth/authorize?...',
        'Sec-Fetch-Dest: script',
        'Sec-Fetch-Mode: no-cors',
        'Sec-Fetch-Site: same-origin',
    ];
    const hdrFlag = headers.map(h => `-H "${h}"`).join(' ');
    const res = await exec("curl -s -D /tmp/ct_hdr.txt -o /tmp/ct_body.bin --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' " + hdrFlag + " 'https://polaryon.com.br/frontend_latest/authorize.42655b7d5f1c1f3e.js' 2>&1");
    const hdr = await exec("cat /tmp/ct_hdr.txt");
    console.log('Response headers:');
    console.log(hdr.substring(0, 600));
    // Check first bytes
    const firstBytes = await exec("xxd /tmp/ct_body.bin | head -3");
    const ct = await exec("file -b /tmp/ct_body.bin");
    console.log('\nFirst bytes:', firstBytes);
    console.log('File type:', ct);

    // 3. Test with a unique URL to bypass cache
    console.log('\n=== Verify with 200 status ===');
    const status = await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' 'https://polaryon.com.br/frontend_latest/authorize.42655b7d5f1c1f3e.js' 2>&1");
    console.log('HTTP status:', status);

    // 4. Check that the first bytes look like JS, not HTML
    console.log('\n=== Content check (starts with?) ===');
    const bodyStart = await exec("dd if=/tmp/ct_body.bin bs=1 count=30 2>/dev/null");
    console.log('Body start:', bodyStart);

    // 5. Test if the frontend_latest location is having an issue with the exact filename
    console.log('\n=== Listing HA frontend_latest dir ===');
    const files = await exec("curl -s --max-time 5 http://127.0.0.1:8123/frontend_latest/ 2>&1 | grep -i author || echo 'not a directory listing'");
    console.log(files);

    conn.end();
})();
