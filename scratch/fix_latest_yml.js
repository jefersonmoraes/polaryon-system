import { Client } from 'ssh2';

const conn = new Client();
const config = {
    host: '204.168.151.231',
    port: 22,
    username: 'root',
    password: 'Jaguar2018jolela#'
};

const content = `version: 3.6.11
files:
  - url: Polaryon-v3.6.11-Setup.exe
    sha512: PBexWZH4TnrsR1pnuUN/rD0xLipvnBDg1xzQIV1d1kOfQ64Y8Mi5zrPvBNCjAGS1VRLqVcQNFYPgOeKKLCwS5g==
    size: 124848291
path: Polaryon-v3.6.11-Setup.exe
sha512: PBexWZH4TnrsR1pnuUN/rD0xLipvnBDg1xzQIV1d1kOfQ64Y8Mi5zrPvBNCjAGS1VRLqVcQNFYPgOeKKLCwS5g==
releaseDate: '2026-05-15T12:25:29.980Z'
`;

conn.on('ready', () => {
    console.log('✅ Conectado para correção do latest.yml...');
    
    // Usando printf para evitar problemas com aspas e quebras de linha
    const escapedContent = Buffer.from(content).toString('base64');
    const command = `echo "${escapedContent}" | base64 -d > /var/www/polaryon/storage/download/latest.yml && chown www-data:www-data /var/www/polaryon/storage/download/latest.yml && chmod 755 /var/www/polaryon/storage/download/latest.yml`;

    conn.exec(command, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('🏁 latest.yml atualizado com sucesso na VPS!');
            conn.end();
        }).on('data', (data) => console.log(data.toString()));
    });
}).connect(config);
