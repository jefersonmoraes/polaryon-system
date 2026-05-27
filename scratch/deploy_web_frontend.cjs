const { Client } = require('ssh2');

const vpsIp = "204.168.151.231";
const password = "Jaguar2018jolela#";

console.log("🚀 Deploy seletivo do frontend (preservando /dist/download)...\n");

const conn = new Client();

conn.on('ready', () => {
    console.log("⚡ SSH Conectado!");
    
    const NGINX_ROOT = '/var/www/polaryon/dist';
    const SRC = '/var/www/polaryon/dist_electron';
    
    // Copia assets/ e index.html/desktop.html sem tocar em download/
    const deployCmd = [
        // Git pull
        'cd /var/www/polaryon && git fetch origin main && git reset --hard origin/main',
        // Copia apenas assets/
        `rsync -av --delete ${SRC}/assets/ ${NGINX_ROOT}/assets/`,
        // Copia index.html
        `cp ${SRC}/index.html ${NGINX_ROOT}/index.html`,
        // Copia desktop.html se existir
        `cp ${SRC}/desktop.html ${NGINX_ROOT}/desktop.html 2>/dev/null || true`,
        // Copia favicon se existir
        `cp ${SRC}/favicon-polaryon.svg ${NGINX_ROOT}/favicon-polaryon.svg 2>/dev/null || true`,
        // Restart backend
        'pm2 restart polaryon-backend',
        // Verifica bundle novo
        `echo "--- Bundle OportunidadesSearch na web ---"`,
        `ls -la ${NGINX_ROOT}/assets/ | grep OportunidadesSearch`,
        `echo "--- index.html aponta para ---"`,
        `cat ${NGINX_ROOT}/index.html | grep -o 'OportunidadesSearch[^"]*'`
    ].join(' && ');
    
    console.log("📡 Executando comandos na VPS...\n");
    
    conn.exec(deployCmd, (err, stream) => {
        if (err) { console.error("❌ Exec error:", err); conn.end(); return; }
        
        stream.stdout.on('data', d => console.log(d.toString().trimEnd()));
        stream.stderr.on('data', d => {
            const msg = d.toString().trim();
            // rsync escreve progresso no stderr - não é erro real
            if (!msg.startsWith('sending') && !msg.includes('sent ') && !msg.includes('total size')) {
                console.error('ERR >', msg);
            } else {
                console.log('   ', msg);
            }
        });
        
        stream.on('close', (code) => {
            if (code === 0) {
                console.log("\n✅ DEPLOY WEB CONCLUÍDO COM SUCESSO!");
            } else {
                console.log(`\n⚠️ Finalizado com código ${code} - verificar logs acima`);
            }
            conn.end();
        });
    });
    
}).on('error', (err) => {
    console.error("❌ SSH Error:", err);
}).connect({
    host: vpsIp,
    port: 22,
    username: 'root',
    password: password
});
