import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';

const config = {
    host: '204.168.151.231',
    port: 22,
    username: 'root',
    password: 'Jaguar2018jolela#'
};

const version = '3.5.25';
const remotePath = '/var/www/polaryon/storage/download/';
const localDir = './dist_desktop/';

const files = [
    `Polaryon-v${version}-Setup.exe`,
    `Polaryon-v${version}-Setup.exe.blockmap`,
    'latest.yml'
];

const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Iniciando upload...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let completed = 0;
        
        files.forEach(file => {
            const localPath = path.join(localDir, file);
            const remoteFilePath = remotePath + file;
            
            console.log(`📦 Enviando ${file}...`);
            
            sftp.fastPut(localPath, remoteFilePath, (err) => {
                if (err) {
                    console.error(`❌ Erro no upload de ${file}:`, err);
                    conn.end();
                    return;
                }
                
                console.log(`✅ ${file} enviado com sucesso.`);
                completed++;
                
                if (completed === files.length) {
                    console.log('🎉 Todos os arquivos enviados. Executando comandos remotos...');
                    executeRemoteCommands();
                }
            });
        });
    });
}).connect(config);

function executeRemoteCommands() {
    const remoteCmd = `cd /var/www/polaryon && git fetch origin main && git reset --hard origin/main && cd backend && npx prisma@6 db push && cd .. && npm run build && rm -rf dist/download && ln -s /var/www/polaryon/storage/download dist/download && pm2 restart polaryon-backend`;
    
    conn.exec(remoteCmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log(`🏁 Comandos remotos finalizados com código ${code}`);
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}
