import { Client } from 'ssh2';
import fs from 'fs';

const conn = new Client();

const config = {
    host: '204.168.151.231',
    port: 22,
    username: 'root',
    password: 'Jaguar2018jolela#'
};

console.log('🚀 Conectando ao VPS para atualização do código...');

conn.on('ready', () => {
    console.log('✅ Conectado! Iniciando comandos de atualização...');
    
    // Comandos baseados no deploy.js
    const commands = [
        'cd /var/www/polaryon',
        'git fetch origin main',
        'git reset --hard origin/main',
        'cd backend',
        'npm install',
        'npx prisma@6 db push',
        'cd ..',
        'npm install',
        'npm run build',
        'pm2 restart polaryon-backend',
        'chown -R www-data:www-data /var/www/polaryon/storage/download',
        'chmod -R 755 /var/www/polaryon/storage/download'
    ].join(' && ');

    conn.exec(commands, (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
            console.log(`\n🏁 Processo finalizado com código: ${code}`);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write('⚠️ ' + data);
        });
    });
}).connect(config);
