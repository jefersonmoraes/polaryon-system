import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const vpsIp = '191.252.93.79';
const remotePath = '/var/www/polaryon/storage/download/';

function sshExec(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let out = '', errOut = '';
            stream.on('data', (d) => { out += d.toString(); process.stdout.write(d.toString()); });
            stream.stderr.on('data', (d) => { errOut += d.toString(); process.stderr.write(d.toString()); });
            stream.on('close', (code) => {
                if (code === 0) resolve(out);
                else reject(new Error(`Exit ${code}: ${errOut.slice(0, 500)}`));
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

async function deployExe() {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const version = pkg.version;
    const exeName = `Polaryon-v${version}-Setup.exe`;
    const localExe = path.join(rootDir, 'dist_desktop', exeName);
    const localBlockmap = path.join(rootDir, 'dist_desktop', `${exeName}.blockmap`);
    const localYaml = path.join(rootDir, 'dist_desktop', 'latest.yml');

    console.log(`\n🚀 DEPLOY EXE v${version}\n`);

    if (!fs.existsSync(localExe)) {
        console.error(`❌ EXE não encontrado: ${localExe}`);
        process.exit(1);
    }

    const conn = new Client();
    await new Promise((resolve, reject) => {
        conn.on('ready', resolve);
        conn.on('error', reject);
        conn.connect({
            host: vpsIp, username: 'root',
            password: 'Jaguar2018#', readyTimeout: 15000
        });
    });
    console.log('  ✅ Conectado à VPS');

    // Upload EXE
    console.log(`  📤 Upload ${exeName}...`);
    await sftpPut(conn, localExe, remotePath + exeName);
    console.log('  ✅ EXE enviado');

    // Upload blockmap
    if (fs.existsSync(localBlockmap)) {
        console.log(`  📤 Upload blockmap...`);
        await sftpPut(conn, localBlockmap, remotePath + `${exeName}.blockmap`);
    }

    // Generate latest.yml on VPS
    console.log('  📝 Gerando latest.yml na VPS...');
    const genScript = [
        'const fs=require("fs"),path=require("path");',
        'const dir="/var/www/polaryon/storage/download";',
        'const files=fs.readdirSync(dir).filter(f=>f.startsWith("Polaryon-v")&&f.endsWith("-Setup.exe")).sort().reverse();',
        'if(files.length===0){console.log("no exe");process.exit(0);}',
        'const exe=files[0];',
        'const v=exe.replace(/^Polaryon-v/,"").replace(/-Setup\\.exe$/,"");',
        'const buf=fs.readFileSync(path.join(dir,exe));',
        'const hash=require("crypto").createHash("sha512").update(buf).digest("base64");',
        'const size=buf.length;',
        'const ts=new Date().toISOString();',
        'const yml="version: "+v+"\\nreleaseDate: "+ts+"\\nfiles:\\n  - url: "+exe+"\\n    sha512: "+hash+"\\n    size: "+size+"\\npath: "+exe+"\\nsha512: "+hash+"\\n";',
        'fs.writeFileSync(path.join(dir,"latest.yml"),yml);',
        'console.log("latest.yml: v"+v+" ("+exe+" "+Math.round(size/1024/1024)+"MB)");'
    ].join('');
    const b64 = Buffer.from(genScript).toString('base64');
    await sshExec(conn, `echo ${b64} | base64 -d | node`);

    // Deploy backend/frontend on VPS
    console.log('  🔄 Atualizando backend/frontend na VPS...');
    await sshExec(conn, 'cd /var/www/polaryon && chmod +x vps-deploy.sh && ./vps-deploy.sh 2>&1');

    conn.end();
    console.log(`\n✅ DEPLOY v${version} COMPLETO!\n`);
}

deployExe().catch(e => { console.error('\n❌', e.message); process.exit(1); });
