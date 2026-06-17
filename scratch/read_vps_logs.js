import { Client } from 'ssh2';

const vpsIp = '191.252.93.79';

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS.');
    conn.exec('ls -la /root/.pm2/logs/ && echo "=== OUT LOG ===" && tail -n 200 /root/.pm2/logs/polaryon-backend-out.log && echo "=== ERR LOG ===" && tail -n 200 /root/.pm2/logs/polaryon-backend-error.log', (err, stream) => {
        if (err) throw err;
        stream.on('data', (data) => {
            process.stdout.write(data);
        }).on('close', () => {
            conn.end();
        });
    });
}).connect({
    host: vpsIp,
    username: 'root',
    password: 'Jaguar2018#',
    readyTimeout: 15000
});
