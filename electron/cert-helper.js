const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Helper para armazenar Certificados A1 (.pfx) de forma criptografada localmente.
 */
class CertHelper {
    constructor() {
        this.userDataPath = app.getPath('userData');
        this.certFolder = path.join(this.userDataPath, 'vault');
        
        if (!fs.existsSync(this.certFolder)) {
            fs.mkdirSync(this.certFolder, { recursive: true });
        }

        // Chave de criptografia baseada no ID da máquina (única por PC)
        this.encryptionKey = crypto.createHash('sha256').update(process.platform + process.arch).digest();
    }

    encrypt(buffer) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        return Buffer.concat([iv, encrypted]);
    }

    decrypt(buffer) {
        const iv = buffer.slice(0, 16);
        const encrypted = buffer.slice(16);
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }

    saveCertificate(fileName, buffer, password) {
        const encryptedData = this.encrypt(buffer);
        const encryptedPass = this.encrypt(Buffer.from(password));
        
        fs.writeFileSync(path.join(this.certFolder, 'active.pfx'), encryptedData);
        fs.writeFileSync(path.join(this.certFolder, 'active.pass'), encryptedPass);
        
        return { success: true, fileName };
    }

    getCertificate() {
        try {
            const pfxPath = path.join(this.certFolder, 'active.pfx');
            const passPath = path.join(this.certFolder, 'active.pass');

            if (!fs.existsSync(pfxPath)) return null;

            const encryptedPfx = fs.readFileSync(pfxPath);
            const encryptedPass = fs.readFileSync(passPath);

            return {
                pfx: this.decrypt(encryptedPfx),
                password: this.decrypt(encryptedPass).toString()
            };
        } catch (e) {
            console.error("Erro ao carregar certificado local:", e);
            return null;
        }
    }

    hasCertificate() {
        return fs.existsSync(path.join(this.certFolder, 'active.pfx'));
    }
}

module.exports = new CertHelper();
