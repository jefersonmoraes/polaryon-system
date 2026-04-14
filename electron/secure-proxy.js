const http = require('http');
const https = require('https');
const url = require('url');
const certHelper = require('./cert-helper');

/**
 * Secure Proxy Engine
 * Redireciona tráfego para o Comprasnet injetando o Certificado A1 do usuário.
 */
class SecureProxy {
    constructor() {
        this.server = null;
        this.port = 0;
    }

    start() {
        return new Promise((resolve) => {
            this.server = http.createServer((req, res) => {
                const cert = certHelper.getCertificate();
                const parsedUrl = url.parse(req.url);
                
                // Se não for Comprasnet, só repassa (mas o ideal é usar o proxy apenas para o portal)
                const options = {
                    hostname: parsedUrl.hostname || 'www.comprasnet.gov.br',
                    port: 443,
                    path: parsedUrl.path,
                    method: req.method,
                    headers: { ...req.headers },
                    rejectUnauthorized: false
                };

                // Remove headers que podem causar conflito de proxy
                delete options.headers['host'];
                delete options.headers['connection'];

                // Injeta o Certificado A1 se disponível
                if (cert) {
                    options.pfx = cert.pfx;
                    options.passphrase = cert.password;
                }

                const proxyReq = https.request(options, (proxyRes) => {
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    proxyRes.pipe(res);
                });

                proxyReq.on('error', (err) => {
                    console.error("Erro no Proxy Seguro:", err);
                    res.statusCode = 502;
                    res.end("Erro de Conexão com Comprasnet via Robô.");
                });

                req.pipe(proxyReq);
            });

            this.server.listen(0, '127.0.0.1', () => {
                this.port = this.server.address().port;
                console.log(`[POLARYON] Proxy Seguro ativo na porta ${this.port}`);
                resolve(this.port);
            });
        });
    }

    getProxyUrl() {
        return `http://127.0.0.1:${this.port}`;
    }
}

module.exports = new SecureProxy();
