import { Client } from 'ssh2';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const vpsIp = '191.252.93.79';
const remotePath = '/var/www/polaryon/storage/download/';

function run(cmd, cwd) {
    try {
        execSync(cmd, { stdio: 'inherit', cwd: cwd || rootDir });
        return true;
    } catch { return false; }
}

function sshExec(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let out = '', errOut = '';
            stream.on('data', (d) => { out += d.toString(); process.stdout.write(d.toString()); });
            stream.stderr.on('data', (d) => { errOut += d.toString(); process.stderr.write(d.toString()); });
            stream.on('close', (code) => {
                if (code === 0) resolve(out);
                else reject(new Error(`Exit ${code}: ${errOut.slice(0, 200)}`));
            });
        });
    });
}

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

async function deploy() {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const version = pkg.version;
    const exeName = `Polaryon-v${version}-Setup.exe`;
    const localExe = path.join(rootDir, 'dist_desktop', exeName);
    const localBlockmap = path.join(rootDir, 'dist_desktop', `${exeName}.blockmap`);
    const localYaml = path.join(rootDir, 'dist_desktop', 'latest.yml');

    console.log(`\n🚀 DEPLOY v${version}\n`);

    // 1. Git push
    console.log('[1/4] Git push...');
    run('git add .');
    run(`git commit -m "deploy v${version}"`);
    run('git push origin main');

    // 2. Conectar VPS
    console.log('[2/4] Conectando VPS...');
    const conn = new Client();
    await new Promise((resolve, reject) => {
        conn.on('ready', resolve);
        conn.on('error', reject);
        conn.connect({
            host: vpsIp, username: 'root',
            password: 'Jaguar2018#', readyTimeout: 15000
        });
    });
    console.log('  ✅ Conectado');

    // 3. Upload artefatos (EXE opcional, latest.yml obrigatório)
    console.log('[3/4] Upload artefatos...');
    const sftpUploads = [];
    if (fs.existsSync(localExe)) {
        sftpUploads.push({ local: localExe, remote: remotePath + exeName, label: exeName });
    } else {
        console.log('  ⏭️ EXE não encontrado (GH Actions vai buildar)');
    }
    if (fs.existsSync(localBlockmap)) {
        sftpUploads.push({ local: localBlockmap, remote: remotePath + `${exeName}.blockmap`, label: `${exeName}.blockmap` });
    }
    if (fs.existsSync(localYaml)) {
        sftpUploads.push({ local: localYaml, remote: remotePath + 'latest.yml', label: 'latest.yml' });
    } else {
        console.log('  ⚠️ latest.yml não encontrado!');
    }
    for (const f of sftpUploads) {
        console.log(`  📤 ${f.label}...`);
        await sftpPut(conn, f.local, f.remote);
    }

    // 4. Atualizar backend/frontend na VPS
    console.log('[4/4] Atualizando VPS (git pull + build + restart)...');
    const cmds = [
        'cd /var/www/polaryon',
        'git fetch origin main',
        'git reset --hard origin/main',
        'npx prisma@6 db push 2>&1 || true',
        'npm run build 2>&1',
        'pm2 restart polaryon-backend 2>&1'
    ];
    await sshExec(conn, cmds.join(' && '));

    conn.end();
    console.log(`\n✅ DEPLOY v${version} COMPLETO!`);
    console.log(`📱 VPS atualizada | ${sftpUploads.length} artefatos enviados`);
}

deploy().catch(e => { console.error('\n❌', e.message); process.exit(1); });
