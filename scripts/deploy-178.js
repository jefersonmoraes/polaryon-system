import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const vpsIp = '191.252.93.79';
const remotePath = '/var/www/polaryon/storage/download/';
const version = '3.8.178';
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
        await execCommand(conn, 'cd /var/www/polaryon && git stash && git fetch origin main && git reset --hard origin/main');

        console.log('🚀 Buildando frontend no VPS...');
        await execCommand(conn, 'cd /var/www/polaryon && npm run build 2>&1');

        console.log('🚀 Restartando backend...');
        await execCommand(conn, 'cd /var/www/polaryon && pm2 restart polaryon-backend 2>&1');

        console.log('📤 Enviando EXE do desktop (apenas se EXE existe — evita corromper auto-updater)...');
        const sftp = await promiseSftp(conn);
        const hasExe = fs.existsSync(localExePath);
        if (hasExe) {
            console.log(`  → ${exeName}`);
            await uploadFile(sftp, localExePath, remotePath + exeName);
            if (fs.existsSync(localBlockmapPath)) { console.log(`  → ${blockmapName}`); await uploadFile(sftp, localBlockmapPath, remotePath + blockmapName); }
            if (fs.existsSync(localYamlPath)) { console.log(`  → latest.yml`); await uploadFile(sftp, localYamlPath, remotePath + 'latest.yml'); }
        } else {
            console.log('  ⏭️ Nenhum EXE local encontrado — GitHub Actions vai enviar o EXE e o latest.yml');
        }
        sftp.end();

        console.log('\n✅ DEPLOY v3.8.174 COMPLETO!');
        console.log('📋 Mudanças: v3.8.177 tinha SyntaxError (\\n dentro de crase vira newline literal). v3.8.178: reverte \\n→\\\\n, adiciona strip \\0 do STOMP.');
    } catch (e) { console.error('\n❌ Erro:', e.message); }
    conn.end();
});

conn.connect({ host: vpsIp, username: 'root', password: 'Jaguar2018#', readyTimeout: 30000 });
