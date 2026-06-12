import { Client } from 'ssh2';

const vpsIp = '191.252.93.79';

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS, fetching logs...');
    conn.exec('pm2 logs --lines 100 --raw', (err, stream) => {
        if (err) {
            console.error('Error executing cmd:', err);
            conn.end();
            return;
        }
        stream.on('data', (d) => {
            process.stdout.write(d.toString());
        });
        stream.stderr.on('data', (d) => {
            process.stderr.write(d.toString());
        });
        stream.on('close', () => {
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('Connection error:', err);
}).connect({
    host: vpsIp,
    username: 'root',
    password: 'Jaguar2018#',
    readyTimeout: 15000
});
