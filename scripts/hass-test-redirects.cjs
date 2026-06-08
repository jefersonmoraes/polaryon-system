const { Client } = require('ssh2');
const c = new Client();
const SECRET = '4d151307e73ccfb9b7b84ff31e9a2f6c';
c.on('ready', async () => {
    const e = cmd => new Promise((r,j) => c.exec(cmd, (e,s) => { let o=''; s.on('data',d=>o+=d); s.on('close',()=>r(o.trim())); s.stderr.on('data',d=>o+=d); }));
    for (const [path,label] of [['/logbook','logbook'],['/history','history'],['/map','map'],['/lovelace/0','lovelace'],['/states','states'],['/config','config'],['/energy','energy'],['/profile','profile']]) {
        const code = await e("curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve 'polaryon.com.br:443:127.0.0.1' https://polaryon.com.br" + path + " 2>&1");
        console.log('  ' + (code === '307' ? '✅' : '❌') + ' ' + label.padEnd(15) + ' ' + code);
    }
    c.end();
}).connect({host:'191.252.93.79',username:'root',password:'Jaguar2018#',readyTimeout:15000});
