import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const vpsIp = '191.252.93.79';
const remotePath = '/var/www/polaryon/storage/download/';
const version = '3.8.172';
const exeName = `Polaryon-v${version}-Setup.exe`;
const blockmapName = `${exeName}.blockmap`;

const localExePath = path.join(rootDir, 'dist_desktop', exeName);
const localBlockmapPath = path.join(rootDir, 'dist_desktop', blockmapName);
const localYamlPath = path.join(rootDir, 'dist_desktop', 'latest.yml');

const conn = new Client();

function promiseSftp(conn) {
    return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) reject(err);
            else resolve(sftp);
        });
    });
}

function uploadFile(sftp, local, remote) {
    return new Promise((resolve, reject) => {
        sftp.fastPut(local, remote, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function execCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let stderr = '';
            stream.on('data', (data) => process.stdout.write(data.toString()));
            stream.stderr.on('data', (data) => { stderr += data.toString(); process.stderr.write(data.toString()); });
            stream.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Exit code ${code}: ${stderr}`));
            });
        });
    });
}

conn.on('ready', async () => {
    console.log('🔗 Conectado ao VPS');
    try {
        console.log('📤 Enviando arquivos...');
        const sftp = await promiseSftp(conn);
        if (fs.existsSync(localExePath)) { console.log(`  → ${exeName}`); await uploadFile(sftp, localExePath, remotePath + exeName); }
        if (fs.existsSync(localBlockmapPath)) { console.log(`  → ${blockmapName}`); await uploadFile(sftp, localBlockmapPath, remotePath + blockmapName); }
        if (fs.existsSync(localYamlPath)) { console.log(`  → latest.yml`); await uploadFile(sftp, localYamlPath, remotePath + 'latest.yml'); }
        sftp.end();
        console.log('✅ Upload concluído');

        console.log('🚀 Deploy VPS...');
        await execCommand(conn, [
            'chown -R www-data:www-data /var/www/polaryon/storage/download',
            'chmod -R 755 /var/www/polaryon/storage/download',
            'cd /var/www/polaryon',
            'git fetch origin main',
            'git reset --hard origin/main',
            'cd backend && npx prisma@6 db push && cd ..',
            'npm run build',
            'rm -rf dist/download && ln -s /var/www/polaryon/storage/download dist/download',
            'pm2 restart polaryon-backend'
        ].join(' && '));

        console.log('\n✅ DEPLOY v3.8.172 COMPLETO!');
    } catch (e) { console.error('\n❌ Erro:', e.message); }
    conn.end();
});

conn.connect({ host: vpsIp, username: 'root', password: 'Jaguar2018#', readyTimeout: 30000 });
