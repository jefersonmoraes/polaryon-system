const https = require('https');

https.get('https://polaryon.com.br/download/latest.yml', (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);
}).on('error', (e) => {
    console.error('Error:', e.message);
});
