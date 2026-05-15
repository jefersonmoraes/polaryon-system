import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';

const conn = new Client();
const config = {
    host: '204.168.151.231',
    port: 22,
    username: 'root',
    password: 'Jaguar2018jolela#'
};

const localDir = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\dist_desktop';
const remoteDir = '/var/www/polaryon/storage/download';

const filesToUpload = [
    'Polaryon-v3.6.11-Setup.exe',
    'Polaryon-v3.6.11-Setup.exe.blockmap',
    'latest.yml'
];

conn.on('ready', () => {
    console.log('✅ Conectado via SFTP! Iniciando transferência...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;

        let completed = 0;

        filesToUpload.forEach(fileName => {
            const localPath = path.join(localDir, fileName);
            const remotePath = path.join(remoteDir, fileName);

            console.log(`📤 Subindo: ${fileName}...`);
            
            sftp.fastPut(localPath, remotePath, (err) => {
                if (err) {
                    console.error(`❌ Erro ao subir ${fileName}:`, err);
                } else {
                    console.log(`✅ Sucesso: ${fileName}`);
                }
                
                completed++;
                if (completed === filesToUpload.length) {
                    console.log('🏁 Todos os arquivos foram transferidos!');
                    
                    // Ajustar permissões finais
                    conn.exec(`chown -R www-data:www-data ${remoteDir} && chmod -R 755 ${remoteDir}`, (err, stream) => {
                        stream.on('close', () => {
                            console.log('🛡️ Permissões ajustadas.');
                            conn.end();
                        });
                    });
                }
            });
        });
    });
}).connect(config);
