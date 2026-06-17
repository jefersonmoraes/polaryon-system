import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Ready');
    // Let's get more lines and search for SNIPER or MOTOR or bid logs
    conn.exec('tail -n 250 /root/.pm2/logs/polaryon-backend-out.log', (err, stream) => {
        if (err) throw err;
        stream.on('data', (data) => {
            process.stdout.write(data);
        }).on('close', () => {
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('SSH Error:', err);
}).connect({
    host: '191.252.93.79',
    username: 'root',
    password: 'Jaguar2018#',
    readyTimeout: 15000
});
