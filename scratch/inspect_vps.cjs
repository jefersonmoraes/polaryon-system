const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', async () => {
    console.log('SSH Ready to inspect');
    
    conn.exec('ls -la /var/www/polaryon/ && ls -la /var/www/polaryon/storage/', (err, stream) => {
        if (err) throw err;
        let out = '';
        stream.on('data', (d) => { out += d.toString(); });
        stream.stderr.on('data', (d) => { out += d.toString(); });
        stream.on('close', () => {
            console.log(out);
            conn.end();
        });
    });
}).connect({
    host: '191.252.93.79',
    username: 'root',
    password: 'Jaguar2018#',
    readyTimeout: 15000
});
