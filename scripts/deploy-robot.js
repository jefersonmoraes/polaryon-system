import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const vpsIp = "204.168.151.231";
const remotePath = "/var/www/polaryon/storage/download/";

function deployRobotOnly() {
    console.log('🤖 INICIANDO DEPLOY CIRÚRGICO EXCLUSIVO DO ROBÔ (Sem afetar Web/API)...');

    // 1. Pegar versão atual do package.json
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const version = packageJson.version;
    const exeName = `Polaryon-v${version}-Setup.exe`;
    const localExePath = path.join(rootDir, 'dist_desktop', exeName);

    // 2. Limpar cache local e compilar o EXE nativo do robô
    console.log('Limpando cache do Electron e gerando nova compilação nativa...');
    execSync('npm run clean:electron', { stdio: 'inherit', cwd: rootDir });
    execSync('npm run build:desktop', { stdio: 'inherit', cwd: rootDir });
    execSync('npm run electron:build', { stdio: 'inherit', cwd: rootDir });

    if (!fs.existsSync(localExePath)) {
        console.error(`❌ Erro: Arquivo ${exeName} não foi gerado.`);
        process.exit(1);
    }

    // 3. Atualizar o GitHub de forma silenciosa
    console.log('Sincronizando código com o GitHub...');
    try {
        execSync('git add .', { stdio: 'inherit', cwd: rootDir });
        execSync(`git commit -m "chore(robot): deploy silencioso v${version}"`, { stdio: 'inherit', cwd: rootDir });
        execSync('git push origin main', { stdio: 'inherit', cwd: rootDir });
    } catch (e) {
        console.log('ℹ️ Sem mudanças no Git. Continuando...');
    }

    // 4. Injeção direta no servidor sem reiniciar PM2 ou Prisma
    console.log(`Injetando ${exeName} no repositório de downloads da VPS...`);
    execSync(`scp dist_desktop/${exeName} root@${vpsIp}:${remotePath}${exeName}`, { stdio: 'inherit', cwd: rootDir });
    execSync(`scp dist_desktop/${exeName}.blockmap root@${vpsIp}:${remotePath}${exeName}.blockmap`, { stdio: 'inherit', cwd: rootDir });
    execSync(`scp dist_desktop/latest.yml root@${vpsIp}:${remotePath}latest.yml`, { stdio: 'inherit', cwd: rootDir });

    // 5. Permissões de Leitura do NGINX (Não requer reboot)
    console.log(`Aplicando permissões de Auto-Updater no Nginx...`);
    // Comando remove EXEs velhos (> 2) para proteger o disco da VPS e previnir quedas de DB
    const remoteCmd = `ls -t /var/www/polaryon/storage/download/*.exe | tail -n +3 | xargs -r rm && chown -R www-data:www-data /var/www/polaryon/storage/download && chmod -R 755 /var/www/polaryon/storage/download`;
    execSync(`ssh root@${vpsIp} "${remoteCmd}"`, { stdio: 'inherit' });

    console.log(`\n✅ DEPLOY ISOLADO CONCLUÍDO! A versão v${version} do robô foi atualizada sem derrubar a Web!`);
}

deployRobotOnly();
