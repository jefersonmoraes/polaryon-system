import { Client } from 'ssh2';

const vpsIp = '191.252.93.79';
const cmd = process.argv.slice(2).join(' ') || 'ls -la /var/www/polaryon/backend/dist_prod';

const conn = new Client();
conn.on('ready', () => {
    console.log(`Running on VPS: ${cmd}`);
    conn.exec(cmd, (err, stream) => {
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
