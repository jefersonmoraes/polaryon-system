import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
// Use CRYPTO_SECRET or fallback to hashing JWT_SECRET to ensure 32 bytes key length
const secretString = process.env.CRYPTO_SECRET || process.env.JWT_SECRET || 'polaryon-bidding-engine-insecure-secret-key-32b';
const key = crypto.scryptSync(secretString, 'salt', 32);

export const encryptString = (text: string): string => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    // Return iv:authTag:encryptedText
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

export const decryptString = (encryptedText: string): string => {
    const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error('Invalid encrypted text format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

// PFX is generally treated as binary data. We can base64 it, then encrypt it, 
// or encrypt the buffer directly. For ease of storage as String in Prisma, we encrypt base64 strings.
export const encryptBufferToString = (buffer: Buffer): string => {
    const base64Data = buffer.toString('base64');
    return encryptString(base64Data);
};

export const decryptStringToBuffer = (encryptedText: string): Buffer => {
    const base64Data = decryptString(encryptedText);
    return Buffer.from(base64Data, 'base64');
};
