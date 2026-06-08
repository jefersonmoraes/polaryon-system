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

    // 1. Check ALL paths in the HTML (including inline scripts)
    console.log('=== 1. TODOS os paths no HTML (com sub_filter applied) ===');
    const html = await exec("curl -sL --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1");
    // Find ALL occurrences of / in quotes or template literals or import()
    const findPaths = html.match(/['"`]\/(?:frontend_latest|frontend_es5|static|api|manifest)[^'"`]*/g);
    if (findPaths) {
        findPaths.forEach(p => console.log('  ', p));
    }
    // Also check for paths NOT rewritten
    const unrewritten = html.match(/['"`]\/(?:frontend_latest|frontend_es5|static|manifest)(?!\/[^\/])[^'"`]*/g);
    if (unrewritten) {
        console.log('\n  ❌ UNREWRITTEN paths:');
        unrewritten.forEach(p => console.log('  ', p));
    } else {
        console.log('  ✅ Todos os paths parecem rewritados');
    }

    // 2. Check if /frontend_latest/ without prefix IS a location
    console.log('\n=== 2. Paths SEM prefixo ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1 | head -5"));

    // 3. Check if HA issues redirects correctly
    console.log('\n=== 3. Redirect check (/) ===');
    console.log(await exec("curl -s -D - -o /dev/null --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -10"));

    // 4. Check main onboarding JS module
    console.log('\n=== 4. Onboarding module ===');
    const onboardingJS = await exec("curl -sL --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/frontend_latest/onboarding.e77b3c09ca4667d6.js 2>&1");
    console.log('  Size:', onboardingJS.length, 'bytes');
    console.log('  Starts with:', onboardingJS.substring(0, 100));
    // Find dynamic imports in JS
    const jsImports = onboardingJS.match(/import\(['"`][^'"`]+['"`]\)/g);
    if (jsImports && jsImports.length > 0) {
        console.log('  Dynamic imports:', jsImports.slice(0, 10));
    }

    // 5. Check for service worker
    console.log('\n=== 5. Service worker check ===');
    const swUrl = await exec("curl -sL -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/service_worker.js 2>&1");
    console.log('  /service_worker.js →', swUrl);
    
    // Check if SW is registered
    const swHtml = await exec("curl -sL --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | grep -i 'service.worker' || echo 'NOT FOUND'");
    console.log('  SW reference in HTML:', swHtml.includes('service') ? 'FOUND' : swHtml);

    // Try HA via ip directly to see if it works internally
    console.log('\n=== 6. HA health check (direct) ===');
    console.log(await exec("curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8123/ 2>&1"));

    console.log('\n=== DIAGNÓSTICO COMPLETO ===');
    conn.end();
})();
