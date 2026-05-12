
import { Client } from 'ssh2';

const config = {
    host: '204.168.151.231',
    port: 22,
    username: 'root',
    password: 'Jaguar2018jolela#'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected.');
    
    // Escaping backslashes for the remote shell
    const cmd = `
        mv "/root/\\\\var\\\\www\\\\polaryon\\\\storage\\\\download\\\\latest.yml" /var/www/polaryon/storage/download/latest.yml
        mv "/root/\\\\var\\\\www\\\\polaryon\\\\storage\\\\download\\\\Polaryon-v3.5.98-Setup.exe" /var/www/polaryon/storage/download/Polaryon-v3.5.98-Setup.exe
        mv "/root/\\\\var\\\\www\\\\polaryon\\\\storage\\\\download\\\\Polaryon-v3.5.98-Setup.exe.blockmap" /var/www/polaryon/storage/download/Polaryon-v3.5.98-Setup.exe.blockmap
        chown www-data:www-data /var/www/polaryon/storage/download/*
        chmod 755 /var/www/polaryon/storage/download/*
        echo "✅ Arquivos movidos e permissões corrigidas."
        ls -la /var/www/polaryon/storage/download/
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
