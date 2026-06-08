import { Client } from 'ssh2';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version;
const vpsIp = '191.252.93.79';
const remotePath = '/var/www/polaryon/storage/download/';

function sftpPut(conn, local, remote) {
    return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            sftp.fastPut(local, remote, (e) => {
                sftp.end();
                if (e) reject(e); else resolve();
            });
        });
    });
}

const exeName = `Polaryon-v${version}-Setup.exe`;
const localExe = path.join(rootDir, 'dist_desktop', exeName);
const localBlockmap = path.join(rootDir, 'dist_desktop', `${exeName}.blockmap`);
const localYaml = path.join(rootDir, 'dist_desktop', 'latest.yml');

if (!fs.existsSync(localExe)) {
    console.error(`❌ EXE não encontrado: ${localExe}`);
    process.exit(1);
}

console.log(`\n🚀 UPLOAD v${version} para ${vpsIp}\n`);
console.log(`  EXE: ${exeName} (${(fs.statSync(localExe).size / 1024 / 1024).toFixed(1)} MB)`);

const conn = new Client();
await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({
        host: vpsIp, username: 'root',
        password: 'Jaguar2018#', readyTimeout: 15000
    });
});
console.log('  ✅ Conectado VPS\n');

console.log(`[1/3] Uploading ${exeName}...`);
await sftpPut(conn, localExe, remotePath + exeName);
console.log('  ✅ EXE enviado');

console.log(`[2/3] Uploading blockmap...`);
if (fs.existsSync(localBlockmap)) {
    await sftpPut(conn, localBlockmap, remotePath + `${exeName}.blockmap`);
    console.log('  ✅ Blockmap enviado');
} else {
    console.log('  ⚠️ Blockmap não encontrado, pulando');
}

console.log(`[3/3] Uploading latest.yml...`);
await sftpPut(conn, localYaml, remotePath + 'latest.yml');
console.log('  ✅ latest.yml enviado');

conn.end();
console.log(`\n✅ Deploy v${version} concluído!`);
console.log(`📥 Link: https://polaryon.com.br/download/${exeName}`);
