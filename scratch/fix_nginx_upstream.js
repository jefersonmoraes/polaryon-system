import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Ready');
    const commands = [
        "sed -i 's/localhost:3000/127.0.0.1:3000/g' /etc/nginx/sites-enabled/*",
        "nginx -t",
        "systemctl reload nginx"
    ];
    conn.exec(commands.join(' && '), (err, stream) => {
        if (err) throw err;
        stream.on('data', (data) => {
            process.stdout.write(data);
        });
        stream.stderr.on('data', (data) => {
            process.stderr.write(data);
        });
        stream.on('close', () => {
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
