
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
    
    const cmd = `
        echo "--- ROOT LS ---"
        ls -l / | grep var
        echo "--- TARGET DIR ---"
        ls -la /var/www/polaryon/storage/download/
        echo "--- WEIRD FILES ---"
        ls -la / | grep Polaryon
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
