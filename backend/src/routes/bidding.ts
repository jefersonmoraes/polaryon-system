import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { encryptBufferToString } from '../utils/crypto';
import { requireAuth, AuthRequest } from '../middleware/auth-middleware';
import { Request, Response } from 'express';
// node-forge is needed for parsing pfx. We will just install it.
// import forge from 'node-forge';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for handling file uploads in memory
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for certificate
});

// Create new Bidding Credential (Vault)
router.post('/credentials', requireAuth, upload.single('certificate'), async (req: AuthRequest | any, res: Response) => {
    try {
        const { companyId, alias, password } = req.body;
        const file = req.file;

        if (!companyId || !alias || !password || !file) {
            return res.status(400).json({ error: 'Missing required fields or certificate file' });
        }

        if (!file.originalname.endsWith('.pfx') && !file.originalname.endsWith('.p12')) {
            return res.status(400).json({ error: 'Certificate must be a .pfx or .p12 file' });
        }

        // Encrypt the sensitive data
        const encryptedPassword = encryptBufferToString(Buffer.from(password, 'utf8'));
        const encryptedCertificate = encryptBufferToString(file.buffer);

        // TODO: In the future, use node-forge to extract the CNPJ directly from the PFX
        // For now, we will store a placeholder or require it from the user. We'll use a placeholder.
        const cnpjPlaceHolder = "Extracted-CNPJ-Later"; 

        const credential = await prisma.biddingCredential.create({
            data: {
                companyId,
                alias,
                cnpj: cnpjPlaceHolder,
                certificateData: encryptedCertificate,
                certificatePassword: encryptedPassword,
                isActive: true
            }
        });

        res.json({ success: true, credential: { id: credential.id, alias: credential.alias } });
    } catch (error: any) {
        console.error('Error creating bidding credential:', error);
        res.status(500).json({ error: error.message });
    }
});

// List Bidding Credentials for a company
router.get('/credentials', requireAuth, async (req: AuthRequest | any, res: Response) => {
    try {
        const { companyId } = req.query;
        if (!companyId) return res.status(400).json({ error: 'companyId is required' });

        const credentials = await prisma.biddingCredential.findMany({
            where: { companyId: companyId as string },
            select: {
                id: true,
                alias: true,
                cnpj: true,
                isActive: true,
                createdAt: true
            }
        });

        res.json({ success: true, credentials });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
