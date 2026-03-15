import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// CERTIFICATES
// ==========================================

router.get('/', async (req: Request, res: Response) => {
    try {
        const certs = await prisma.certificate.findMany({
            include: { 
                attachments: {
                    select: {
                        id: true,
                        fileSlot: true,
                        fileName: true,
                        fileSize: true,
                        certificateId: true
                        // Excluindo fileData intencionalmente para evitar lentidão
                    }
                } 
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(certs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


router.post('/', async (req: Request, res: Response) => {
    try {
        const { attachments, ...data } = req.body;
        
        const cert = await prisma.certificate.create({
            data: {
                ...data,
                executionDate: new Date(data.executionDate),
                attachments: {
                    create: attachments?.map((att: any) => ({
                        fileSlot: att.fileSlot,
                        fileName: att.fileName,
                        fileSize: att.fileSize,
                        fileData: att.fileData
                    })) || []
                }
            },
            include: { attachments: true }
        });
        
        res.json(cert);
    } catch (e: any) {
        console.error("Certificate Create Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { attachments, ...data } = req.body;
        const certId = req.params.id as string;

        if (data.executionDate) data.executionDate = new Date(data.executionDate);

        const cert = await prisma.certificate.update({
            where: { id: certId },
            data: {
                ...data,
                attachments: attachments ? {
                    deleteMany: {},
                    create: attachments.map((att: any) => ({
                        fileSlot: att.fileSlot,
                        fileName: att.fileName,
                        fileSize: att.fileSize,
                        fileData: att.fileData
                    }))
                } : undefined
            },
            include: { attachments: true }
        });

        res.json(cert);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await prisma.certificate.delete({
            where: { id: req.params.id as string }
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/attachment/:attachmentId', async (req: Request, res: Response) => {
    try {
        const attachment = await prisma.certificateAttachment.findUnique({
            where: { id: req.params.attachmentId as string },
            select: { fileData: true }
        });
        
        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }
        
        res.json({ fileData: attachment.fileData });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
