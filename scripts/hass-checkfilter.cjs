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

    // Test with follow redirects (-L) to get the actual HTML page
    console.log('=== HTML seguindo redirect ===');
    const html = await exec("curl -sL --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | head -c 3000");
    console.log(html);

    // Check for reescrita
    console.log('\n=== Paths reescritos ===');
    const paths = await exec("curl -sL --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | grep -oE '/hass-[a-z0-9]+/[a-zA-Z0-9/_.-]+' | sort -u | head -15");
    console.log(paths);
    if (paths.includes('hass-' + SECRET)) {
        console.log('✅ sub_filter funcionando!');
    } else {
        console.log('❌ sub_filter NAO funcionou');
    }

    // Count the HA-specific paths
    console.log('\n=== Estatisticas ===');
    console.log(await exec("curl -sL --max-time 10 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br/hass-" + SECRET + "/ 2>&1 | grep -c '/hass-" + SECRET + "/'") + " paths com prefixo HA");

    conn.end();
})();
