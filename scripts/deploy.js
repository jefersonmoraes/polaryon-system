import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const vpsIp = "204.168.151.231";
const remotePath = "/var/www/polaryon/public/download/";

function deploy() {
    console.log('🚀 Iniciando Deploy Automatizado para o VPS...');

    // 1. Pegar versão atual do package.json
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const version = packageJson.version;
    const exeName = `Polaryon-v${version}-Setup.exe`;
    const localExePath = path.join(rootDir, 'dist_desktop', exeName);
    const localYamlPath = path.join(rootDir, 'dist_desktop', 'latest.yml');

    if (!fs.existsSync(localExePath)) {
        console.error(`❌ Erro: Arquivo ${exeName} não encontrado em dist_desktop/`);
        process.exit(1);
    }

    try {
        // 2. Upload EXE
        console.log(`uploading ${exeName} para o servidor...`);
        execSync(`scp dist_desktop/${exeName} root@${vpsIp}:${remotePath}`, { stdio: 'inherit', cwd: rootDir });

        // 3. Upload latest.yml
        console.log(`uploading latest.yml...`);
        execSync(`scp dist_desktop/latest.yml root@${vpsIp}:${remotePath}`, { stdio: 'inherit', cwd: rootDir });

        // 4. Sync Git e Restart no VPS
        console.log(`Sincronizando código e reiniciando backend no VPS...`);
        const remoteCmd = `cd /var/www/polaryon && git pull origin main && pm2 restart polaryon-backend`;
        execSync(`ssh root@${vpsIp} "${remoteCmd}"`, { stdio: 'inherit' });

        console.log('\n✅ DEPLOY COMPLETO! A versão v' + version + ' está ao vivo e pronta para download/update.');
    } catch (error) {
        console.error('❌ Falha no deploy:', error.message);
        process.exit(1);
    }
}

deploy();
