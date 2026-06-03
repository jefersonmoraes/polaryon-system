const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const host = '191.252.93.79';
const port = 22;
const username = 'root';
const password = 'Jaguar2018#';
const remoteDir = '/var/www/polaryon/storage/download/';

const files = [
    'dist_desktop/Polaryon-v3.8.178-Setup.exe',
    'dist_desktop/Polaryon-v3.8.178-Setup.exe.blockmap',
    'dist_desktop/latest.yml'
];

conn.on('ready', () => {
    console.log('🔗 Conectado ao VPS');
    uploadNext(0);
});

function uploadNext(idx) {
    if (idx >= files.length) {
        console.log('✅ Upload concluído!');
        conn.end();
        return;
    }
    const localPath = files[idx];
    const remotePath = remoteDir + path.basename(localPath);
    const fileSize = fs.statSync(localPath).size;
    console.log(`📤 Enviando ${path.basename(localPath)} (${(fileSize/1024/1024).toFixed(1)}MB)...`);
    
    conn.sftp((err, sftp) => {
        if (err) { console.error('SFTP erro:', err); conn.end(); return; }
        sftp.fastPut(localPath, remotePath, {
            concurrency: 4
        }, (err) => {
            sftp.end();
            if (err) { console.error('Upload erro:', err); conn.end(); return; }
            console.log(`  ✅ ${path.basename(localPath)} enviado`);
            uploadNext(idx + 1);
        });
    });
}

conn.on('error', (err) => { console.error('❌ Erro SSH:', err.message); });
conn.connect({ host, port, username, password });
