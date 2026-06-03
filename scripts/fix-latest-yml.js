import { Client } from 'ssh2';
import { fileURLToPath } from 'url';

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
  'console.log("OK v"+v+" "+Math.round(size/1024/1024)+"MB");'
].join('');

const b64 = Buffer.from(genScript).toString('base64');
console.log('Base64 length:', b64.length);

const conn = new Client();
conn.on('ready', () => {
  conn.exec('echo ' + b64 + ' | base64 -d | node', (err, stream) => {
    if (err) { console.error('exec err:', err); conn.end(); return; }
    let out = '';
    stream.on('data', d => { out += d.toString(); process.stdout.write(d); });
    stream.stderr.on('data', d => { process.stderr.write(d); });
    stream.on('close', code => {
      console.log('exit:', code, '| out:', out.trim());
      conn.end();
    });
  });
});
conn.connect({ host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
