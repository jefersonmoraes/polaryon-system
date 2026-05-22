const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const vpsIp = "204.168.151.231";
const password = "Jaguar2018jolela#";
const remotePath = "/var/www/polaryon/storage/download/";
const rootDir = path.resolve(__dirname, '..');

const version = "3.8.24";
const exeName = `Polaryon-v${version}-Setup.exe`;

const filesToUpload = [
    { local: path.join(rootDir, 'dist_desktop', exeName), remote: remotePath + exeName },
    { local: path.join(rootDir, 'dist_desktop', `${exeName}.blockmap`), remote: remotePath + `${exeName}.blockmap` },
    { local: path.join(rootDir, 'dist_desktop', 'latest.yml'), remote: remotePath + 'latest.yml' }
];

for (const file of filesToUpload) {
    if (!fs.existsSync(file.local)) {
        console.error(`Arquivo nao encontrado: ${file.local}`);
        process.exit(1);
    }
}

console.log(`Enviando ${version} para o VPS...`);

const conn = new Client();
conn.on('ready', () => {
    console.log("Conectado! Enviando arquivos...");
    
    conn.sftp((err, sftp) => {
        if (err) { console.error("SFTP error:", err); conn.end(); return; }
        
        let uploaded = 0;
        function uploadNext() {
            if (uploaded === filesToUpload.length) {
                console.log("Todos os arquivos enviados!");
                runCleanup();
                return;
            }
            const file = filesToUpload[uploaded];
            console.log(`Enviando ${path.basename(file.local)}...`);
            sftp.fastPut(file.local, file.remote, (uploadErr) => {
                if (uploadErr) { console.error("Falha:", uploadErr); conn.end(); return; }
                console.log(`  OK: ${path.basename(file.local)}`);
                uploaded++;
                uploadNext();
            });
        }
        uploadNext();
    });
}).connect({
    host: vpsIp, port: 22, username: 'root', password: password
});

function runCleanup() {
    const cmd = `ls -t /var/www/polaryon/storage/download/*.exe | tail -n +3 | xargs -r rm && chown -R www-data:www-data /var/www/polaryon/storage/download && chmod -R 755 /var/www/polaryon/storage/download && echo "OK"`;
    conn.exec(cmd, (err, stream) => {
        if (err) { console.error("Erro no cleanup:", err); conn.end(); return; }
        stream.on('close', () => {
            console.log("Permissoes aplicadas. Deploy concluido!");
            console.log(`\nRobo v${version} enviado para auto-update em https://polaryon.com.br/download/`);
            conn.end();
        });
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    });
}
