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

    // Check ALL imports in onboarding JS 
    console.log('=== Imports no onboarding.js ===');
    const js = await exec("curl -sL --max-time 15 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1");
    
    // Find all import() and import ... from patterns
    const dynImports = js.match(/import\(["'`][^"'`]+["'`]\)/g) || [];
    console.log(`Dynamic imports (${dynImports.length}):`);
    dynImports.forEach(i => console.log('  ', i));

    // Find all paths starting with /
    const absPaths = js.match(/["'`]\/[^"'`]*["'`]/g) || [];
    const haPaths = absPaths.filter(p => /frontend|static|api|manifest/.test(p));
    if (haPaths.length > 0) {
        console.log(`\nAbsolute HA paths (${haPaths.length}):`);
        haPaths.forEach(p => {
            const hasPrefix = p.includes(SECRET);
            console.log('  ' + (hasPrefix ? '✅' : '❌') + ' ' + p);
        });
    }

    // Check if sub_filter for JS is even being applied
    console.log('\n=== sub_filter check ===');
    const testReq = await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1 | head -10");
    console.log(testReq);

    // Check the full HA HTML for ALL absolute paths (not just href=)
    console.log('\n=== TODOS os paths absolutos no HTML ===');
    const html = await exec("curl -sL --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1");
    const allPaths = html.match(/["'`]\/(?:[a-zA-Z0-9_\/.-]+)["'`]/g) || [];
    allPaths.forEach(p => {
        if (p.includes('hass')) return; // skip rewritten
        const clean = p.replace(/['"`]/g, '');
        // only HA paths
        if (/^(frontend|static|api|manifest)/.test(clean.replace(/^\//, ''))) {
            console.log('  ❌ UNREWRITTEN:', clean);
        }
    });

    console.log('\n=== DONE ===');
    conn.end();
})();
