const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const rootDir = 'E:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system';
const remotePath = '/var/www/polaryon/storage/download/';
const vpsIp = '191.252.93.79';
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version;
const exeName = 'Polaryon-v' + version + '-Setup.exe';
const localExe = path.join(rootDir, 'dist_desktop', exeName);
const localBlockmap = path.join(rootDir, 'dist_desktop', exeName + '.blockmap');

console.log('\n🚀 DEPLOY v' + version + '\n');

async function run() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host: vpsIp, username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
  });
  console.log('✅ Conectado VPS');

  console.log('📤 Upload ' + exeName + '...');
  await sftpPut(conn, localExe, remotePath + exeName);
  if (fs.existsSync(localBlockmap)) {
    console.log('📤 Upload blockmap...');
    await sftpPut(conn, localBlockmap, remotePath + exeName + '.blockmap');
  }

  console.log('🔄 Atualizando backend na VPS...');
  await sshExec(conn, 'cd /var/www/polaryon && git fetch origin main && git reset --hard origin/main && npm run build 2>&1 && pm2 restart polaryon-backend 2>&1');

  console.log('📝 Gerando latest.yml...');
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
  await sshExec(conn, 'echo ' + b64 + ' | base64 -d | node');

  conn.end();
  console.log('\n✅ DEPLOY v' + version + ' COMPLETO!');
}

function sftpPut(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(local, remote, (e) => { sftp.end(); if (e) reject(e); else resolve(); });
    });
  });
}

function sshExec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '', errOut = '';
      stream.on('data', (d) => { out += d.toString(); process.stdout.write(d.toString()); });
      stream.stderr.on('data', (d) => { errOut += d.toString(); process.stderr.write(d.toString()); });
      stream.on('close', (code) => { if (code === 0) resolve(out); else reject(new Error('Exit ' + code + ': ' + errOut.slice(0, 200))); });
    });
  });
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
