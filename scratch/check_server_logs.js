
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
    
    // Check access logs for latest.yml
    const cmd = `
        echo "--- NGINX ACCESS LOG (last 20) ---"
        tail -n 50 /var/log/nginx/access.log | grep latest.yml
        echo "\n--- NGINX ERROR LOG (last 5) ---"
        tail -n 5 /var/log/nginx/error.log
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
