const { Client } = require('ssh2');

const vpsIp = "204.168.151.231";
const password = "Jaguar2018jolela#";

console.log("🛠️ Limpando travas de referências do Git na VPS e forçando sincronização...");

const conn = new Client();

conn.on('ready', () => {
    console.log("⚡ SSH Conectado!");
    
    const repairCmd = [
        'cd /var/www/polaryon',
        // 1. Limpar travas do Git e referências corrompidas
        'rm -f .git/refs/remotes/origin/main',
        'rm -f .git/refs/remotes/origin/main.lock',
        'rm -f .git/FETCH_HEAD.lock',
        'git gc --prune=now',
        // 2. Forçar sincronização
        'git fetch origin main',
        'git reset --hard origin/main',
        // 3. Prisma db push
        'cd backend && npx prisma@6 db push && cd ..',
        // 4. Compilar web app
        'npm run build',
        // 5. Garantir links e permissões
        'rm -rf dist/download',
        'ln -s /var/www/polaryon/storage/download dist/download',
        'chown -R www-data:www-data /var/www/polaryon/storage/download',
        'chmod -R 755 /var/www/polaryon/storage/download',
        // 6. Reiniciar PM2
        'pm2 restart polaryon-backend',
        'echo "⭐️ REPARADO E DEPLOYADO COM SUCESSO!"'
    ].join(' && ');

    conn.exec(repairCmd, (err, stream) => {
        if (err) {
            console.error("❌ Exec remoto falhou:", err);
            conn.end();
            return;
        }

        stream.stdout.on('data', d => console.log(d.toString().trimEnd()));
        stream.stderr.on('data', d => console.error('VPS ERR >', d.toString().trimEnd()));

        stream.on('close', (code) => {
            if (code === 0) {
                console.log("\n🎉 VPS REPARADO E ATUALIZADO COM TOTAL SUCESSO!");
            } else {
                console.log(`\n⚠️ Finalizado com código de erro ${code}`);
            }
            conn.end();
        });
    });

}).on('error', (err) => {
    console.error("❌ Erro SSH:", err);
}).connect({
    host: vpsIp,
    port: 22,
    username: 'root',
    password: password
});
