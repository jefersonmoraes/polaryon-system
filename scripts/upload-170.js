import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const remotePath = '/var/www/polaryon/storage/download/';
const exeName = 'Polaryon-v3.8.170-Setup.exe';
const blockmapName = `${exeName}.blockmap`;

const localExePath = path.join(rootDir, 'dist_desktop', exeName);
const localBlockmapPath = path.join(rootDir, 'dist_desktop', blockmapName);
const localYamlPath = path.join(rootDir, 'dist_desktop', 'latest.yml');

const conn = new Client();

function uploadFile(local, remote) {
    return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            sftp.fastPut(local, remote, (err2) => {
                if (err2) return reject(err2);
                sftp.end();
                resolve();
            });
        });
    });
}

conn.on('ready', async () => {
    console.log(`📤 Enviando ${exeName}...`);
    await uploadFile(localExePath, remotePath + exeName);
    console.log('✅ EXE enviado');
    
    if (fs.existsSync(localBlockmapPath)) {
        await uploadFile(localBlockmapPath, remotePath + blockmapName);
        console.log('✅ Blockmap enviado');
    }
    if (fs.existsSync(localYamlPath)) {
        await uploadFile(localYamlPath, remotePath + 'latest.yml');
        console.log('✅ latest.yml enviado');
    }
    console.log('🎉 Upload concluído v3.8.170!');
    conn.end();
}).connect({
    host: '191.252.93.79',
    username: 'root',
    password: 'Jaguar2018#',
    readyTimeout: 30000
});
