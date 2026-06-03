import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const vpsIp = "191.252.93.79";
const remotePath = "/var/www/polaryon/storage/download/";

function run(cmd, cwd) {
    try {
        execSync(cmd, { stdio: 'inherit', cwd: cwd || rootDir });
    } catch (e) {
        return false;
    }
    return true;
}

function deploy() {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const version = packageJson.version;
    const exeName = `Polaryon-v${version}-Setup.exe`;
    const localExePath = path.join(rootDir, 'dist_desktop', exeName);
    const localBlockmapPath = path.join(rootDir, 'dist_desktop', `${exeName}.blockmap`);
    const localYamlPath = path.join(rootDir, 'dist_desktop', 'latest.yml');

    console.log(`\n🚀 INICIANDO DEPLOY v${version}...\n`);

    // 1. Git push
    console.log('[1/4] Sincronizando com GitHub...');
    run('git add .');
    run(`git commit -m "deploy v${version}"`);
    run('git push origin main');

    // 2. SCP EXE + blockmap + latest.yml (se existirem)
    console.log(`\n[2/4] Enviando artefatos para VPS...`);
    const scpFiles = [];
    if (fs.existsSync(localExePath)) {
        scpFiles.push(exeName);
        console.log(`  ✅ EXE encontrado: ${exeName}`);
    } else {
        console.log(`  ⏭️ EXE não encontrado (GH Actions vai buildar depois)`);
    }
    if (fs.existsSync(localBlockmapPath)) {
        scpFiles.push(`${exeName}.blockmap`);
    }
    // SEMPRE envia latest.yml — crucial para o auto-updater saber da versão
    if (fs.existsSync(localYamlPath)) {
        scpFiles.push('latest.yml');
        console.log(`  ✅ latest.yml encontrado`);
    } else {
        console.log(`  ⚠️ latest.yml não encontrado — auto-updater pode quebrar`);
    }

    if (scpFiles.length > 0) {
        // Gera lista de arquivos tipo "dist_desktop/Polaryon-v3.8.181-Setup.exe dist_desktop/latest.yml"
        const filesArg = scpFiles.map(f => `dist_desktop/${f}`).join(' ');
        run(`scp ${filesArg} root@${vpsIp}:${remotePath}`);
    }

    // 3. SSH: puxar código, buildar, restartar backend
    console.log(`\n[3/4] Atualizando backend/frontend na VPS...`);
    const remoteCmd = [
        'cd /var/www/polaryon',
        'git fetch origin main',
        'git reset --hard origin/main',
        'npx prisma@6 db push 2>&1 || true',
        'npm run build 2>&1',
        'pm2 restart polaryon-backend 2>&1',
        'echo "✅ VPS atualizada"'
    ].join(' && ');
    run(`ssh root@${vpsIp} "${remoteCmd}"`);

    // 4. Verificar resultado
    console.log(`\n[4/4] Verificando deploy...`);
    try {
        const check = execSync(`ssh root@${vpsIp} "cat /var/www/polaryon/package.json | grep version | head -1"`, { encoding: 'utf8' });
        const vpsVersion = check.match(/"version":\s*"([^"]+)"/)?.[1];
        if (vpsVersion === version) {
            console.log(`\n✅ DEPLOY v${version} COMPLETO! VPS e GitHub sincronizados.`);
        } else {
            console.log(`\n⚠️ Versão local=${version}, VPS=${vpsVersion || 'desconhecida'}`);
        }
    } catch (e) {
        console.log(`\n⚠️ Não foi possível verificar versão na VPS`);
    }

    console.log(`\n📱 Auto-updater: ${fs.existsSync(localYamlPath) ? '✅ latest.yml enviado' : '⚠️ pendente (GH Actions vai gerar)'}`);
}

deploy();
