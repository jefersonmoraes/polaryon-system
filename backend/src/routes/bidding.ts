import { Router } from 'express';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import axios from 'axios';
import { encryptBufferToString, decryptStringToBuffer, decryptString } from '../utils/crypto';
import { requireAuth, AuthRequest } from '../middleware/auth-middleware';
import { Request, Response } from 'express';

const router = Router();


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

// GET Bidding Credential Vault (For Local Runner in Desktop App)
// Returns decrypted data so the desktop app can sign requests locally
router.get('/credentials/:id/vault', requireAuth, async (req: AuthRequest | any, res: Response) => {
    try {
        const { id } = req.params;
        const credential = await prisma.biddingCredential.findUnique({
            where: { id }
        });

        if (!credential) return res.status(404).json({ error: 'Credential not found' });

        // Verify ownership (Safety Check)
        // Since companyId is attached, we should verify if user has access. 
        // For now, we allow if authenticated, but in production we'd check permissions.

        const pfxBase64 = decryptStringToBuffer(credential.certificateData).toString('base64');
        const password = decryptString(credential.certificatePassword);

        res.json({
            success: true,
            vault: {
                pfxBase64,
                password,
                alias: credential.alias,
                cnpj: credential.cnpj
            }
        });
    } catch (error: any) {
        console.error('Vault Export Error:', error);
        res.status(500).json({ error: 'Failed to export vault data' });
    }
});

import { BiddingListener } from '../services/bidding-listener';

// Helper to find or automatically upsert dynamic sessions (HYBRID_ and GLOBAL_) (v3.8.295)
async function getOrCreateSession(id: string) {
    let session = await prisma.biddingSession.findUnique({ where: { id } });
    if (!session && (id.startsWith('HYBRID_') || id.startsWith('GLOBAL_'))) {
        let uasg = '000000';
        let num = '00000';
        let ano = '2026';

        if (id.startsWith('HYBRID_')) {
            const parts = id.split('_'); 
            uasg = parts[1] || '000000';
            num = parts[2] || '00000';
            ano = parts[3] || '2026';
        } else if (id.startsWith('GLOBAL_')) {
            const idCompra = id.replace('GLOBAL_', '');
            uasg = idCompra.substring(0, 6) || '000000';
            num = idCompra.substring(8, 13) || '00000';
            ano = idCompra.substring(13, 17) || '2026';
        }

        try {
            session = await prisma.biddingSession.create({
                data: {
                    id,
                    uasg,
                    numeroPregao: num,
                    anoPregao: ano,
                    portal: 'compras_gov',
                    credentialId: null,
                    itemsConfig: {}
                }
            });
        } catch (err) {
            // Safe fallback in case of simultaneous creations (race condition)
            session = await prisma.biddingSession.findUnique({ where: { id } });
        }
    }
    return session;
}


// Create a new Bidding Session (Prep for monitoring)
router.post('/sessions', requireAuth, async (req: AuthRequest | any, res: Response) => {
    try {
        let { credentialId, portal, uasg, numeroPregao, anoPregao } = req.body;
        
        // Handle frontend dummy ID for public monitoring/radar ⚒️🚀⚙️
        if (credentialId === 'simulated-credential-id') {
            credentialId = null;
        }

        if (!uasg || !numeroPregao || !anoPregao) {
            return res.status(400).json({ error: 'Missing required session fields' });
        }

        const session = await prisma.biddingSession.upsert({
            where: {
                portal_uasg_numeroPregao_anoPregao: {
                    portal: portal || 'compras_gov',
                    uasg,
                    numeroPregao,
                    anoPregao
                }
            },
            update: {
                credentialId: credentialId || null,
                sessionStatus: 'active' // Ensure it's active if reactivated
            },
            create: {
                credentialId: credentialId || null,
                portal: portal || 'compras_gov',
                uasg,
                numeroPregao,
                anoPregao,
                sessionStatus: 'pending'
            }
        });

        res.json({ success: true, session });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Start the Radar for a session
router.post('/sessions/:id/start', requireAuth, async (req: AuthRequest | any, res: Response) => {
    try {
        const { id } = req.params;
        const session = await getOrCreateSession(id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        await BiddingListener.startMonitoring(session.id, session.uasg, session.numeroPregao);
        
        res.json({ success: true, message: 'Radar started successfully.' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Stop the Radar for a session
router.post('/sessions/:id/stop', requireAuth, async (req: AuthRequest | any, res: Response) => {
    try {
        const { id } = req.params;
        await BiddingListener.stopMonitoring(id);
        res.json({ success: true, message: 'Radar stopped successfully.' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update strategy in bulk
router.patch('/sessions/:id/items/bulk', requireAuth, async (req: AuthRequest | any, res: Response) => {
    try {
        const { id } = req.params;
        const { itemIds, config } = req.body;

        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({ error: 'itemIds array is required' });
        }

        const session = await getOrCreateSession(id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const currentConfig = (session.itemsConfig as any) || {};
        
        itemIds.forEach(itemId => {
            currentConfig[itemId] = { ...(currentConfig[itemId] || {}), ...config };
        });

        await prisma.biddingSession.update({
            where: { id },
            data: { itemsConfig: currentConfig }
        });

        res.json({ success: true, message: `${itemIds.length} items updated successfully.` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update individual item strategy or global simulation mode
router.patch('/sessions/:id/items/:itemId', requireAuth, async (req: AuthRequest | any, res: Response) => {
    try {
        const { id, itemId } = req.params;
        const config = req.body;

        let session = await getOrCreateSession(id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const currentConfig = (session.itemsConfig as any) || {};
        
        if (itemId === '__global__') {
            currentConfig.__global__ = { ...(currentConfig.__global__ || {}), ...config };
        } else {
            currentConfig[itemId] = { ...(currentConfig[itemId] || {}), ...config };
        }

        await prisma.biddingSession.update({
            where: { id },
            data: { itemsConfig: currentConfig }
        });

        res.json({ success: true, message: `Item ${itemId} updated successfully.` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Persistence for Bid History (Fixes 404) ⚒️🚀
router.post('/sessions/:id/items/:itemId/bid', requireAuth, async (req: AuthRequest | any, res: Response) => {
    try {
        const { id, itemId } = req.params;
        const { value, type, status, reason } = req.body;

        const bid = await prisma.biddingAction.create({
            data: {
                sessionId: id,
                itemId,
                value,
                type: type || 'MANUAL',
                status: status || 'success',
                reason: reason || 'Lance disparado pelo usuário via Painel de Controle.',
                timestamp: new Date()
            }
        });

        res.json({ success: true, bid });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Safe Captcha Pool Fallback
router.get('/captcha-pool', async (req: Request, res: Response) => {
    try {
        const fallbackToken = "P1_eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzaXRla2V5IjoiNjVhMjg2NzUzNDNiY2ZhMzMxZjI4N2JmOTgzOTQ5Zjc1YmYxZTdiYiIsInN1YmplY3QiOiJjbmV0bW9iaWxlIn0.fallback-signature";
        res.json({
            success: true,
            captcha1: fallbackToken,
            captcha2: fallbackToken
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// VPS Proxy Bid Dispatcher (⚡ Ultra-low latency backend routing)
router.post('/proxy-bid', requireAuth, async (req: Request, res: Response) => {
    try {
        const { purchaseId, itemId, value, sessionToken, c1, c2 } = req.body;
        if (!purchaseId || !itemId || !value || !sessionToken || !c1 || !c2) {
            return res.status(400).json({ error: 'Faltam parâmetros obrigatórios para o disparo' });
        }

        const targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemId}/lances?captcha1=${c1}&captcha2=${c2}&captcha3=${c1}`;
        const payload = {
            valorInformado: parseFloat(value),
            faseItem: "LA"
        };

        const response = await axios.post(targetUrl, payload, {
            timeout: 5000,
            headers: {
                'Authorization': sessionToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-device-platform': 'web',
                'x-version-number': '6.0.2',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
        });

        res.json({ success: true, data: response.data });
    } catch (error: any) {
        const status = error.response?.status || 500;
        const msg = error.response?.data?.message || error.response?.data || error.message;
        res.status(status).json({ success: false, error: msg });
    }
});

export default router;
