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

    // Get authorize.js from auth page
    const authHtml = await exec("curl -sL --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' 'https://polaryon.com.br/hass-" + SECRET + "/auth/authorize?response_type=code&client_id=test' 2>&1");
    const ref = authHtml.match(/\/frontend_latest\/authorize\.[^"']+/);
    if (ref) {
        const jsPath = ref[0];
        console.log('Authorize JS path:', jsPath);
        // Download the JS file
        const js = await exec("curl -s --max-time 15 --resolve 'polaryon.com.br:443:127.0.0.1' 'https://polaryon.com.br" + jsPath + "' 2>&1");
        // Check for corrupted patterns - should NOT contain hass-xxx
        const hasHassPrefix = js.includes('hass-' + SECRET);
        console.log('Contains hass-xxx prefix:', hasHassPrefix ? '❌ YES (sub_filter applied to JS!)' : '✅ NO (JS is clean)');
        
        // Check for auth paths - the JS might reference /auth/ in strings
        const authRefs = js.match(/["'`]\/auth\/[^"'`]+/g);
        if (authRefs) {
            console.log('/auth/ refs in JS:', authRefs.slice(0, 5));
        } else {
            console.log('No /auth/ paths found in JS');
        }
    } else {
        console.log('No authorize.js reference found');
    }

    // Verify SW content
    console.log('\nSW:');
    const sw = await exec("curl -s --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/sw-modern.js 2>&1 | head -5");
    console.log(sw);

    conn.end();
})();
