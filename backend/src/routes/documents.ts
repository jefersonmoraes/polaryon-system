import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { pushEventToGoogle, deleteEventFromGoogle } from '../services/GoogleCalendarService';

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// COMPANY DOCUMENTS
// ==========================================

router.get('/company', async (req: Request, res: Response) => {
    try {
        const docs = await prisma.companyDocument.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(docs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/company', async (req: Request, res: Response) => {
    try {
        const body = req.body;

        // Filtra apenas os campos que existem no schema do Prisma
        const data: any = {
            title: body.title,
            type: body.type,
            status: body.status || 'valid',
        };

        if (body.id) data.id = body.id;
        if (body.issueDate) data.issueDate = new Date(body.issueDate);
        if (body.expirationDate) data.expirationDate = new Date(body.expirationDate);
        if (body.link !== undefined) data.link = body.link;
        if (body.description !== undefined) data.description = body.description;
        if (body.observations !== undefined) data.observations = body.observations;
        if (body.whereToIssue !== undefined) data.whereToIssue = body.whereToIssue;
        if (body.fileData !== undefined) data.fileData = body.fileData;
        if (body.fileName !== undefined) data.fileName = body.fileName;
        if (body.fileSize !== undefined) data.fileSize = body.fileSize;
        if (body.companyId !== undefined) data.companyId = body.companyId;
        if (body.attachments !== undefined) data.attachments = body.attachments;
        if (body.trashed !== undefined) data.trashed = body.trashed;
        if (body.trashedAt !== undefined) data.trashedAt = body.trashedAt ? new Date(body.trashedAt) : null;
        if (body.createdAt) data.createdAt = new Date(body.createdAt);

        const doc = await prisma.companyDocument.create({ data });

        // Auto-sync to Google Calendar
        if (doc.expirationDate && !doc.trashed) {
            pushEventToGoogle({
                summary: `[Doc] ${doc.title}`,
                description: `*[Gerado pelo Polaryon]*\n\nEste documento tem vencimento programado.\nTipo: ${doc.type}`,
                start: { date: new Date(doc.expirationDate).toISOString().split('T')[0] },
                end: { date: new Date(doc.expirationDate).toISOString().split('T')[0] }
            }, doc.id).catch(err => console.error("Document background sync failed:", err));
        }

        res.json(doc);
    } catch (e: any) {
        console.error("Company Document Create Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/company/:id', async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const data: any = {};

        if (body.title !== undefined) data.title = body.title;
        if (body.type !== undefined) data.type = body.type;
        if (body.status !== undefined) data.status = body.status;
        if (body.issueDate !== undefined) data.issueDate = body.issueDate ? new Date(body.issueDate) : null;
        if (body.expirationDate !== undefined) data.expirationDate = body.expirationDate ? new Date(body.expirationDate) : null;
        if (body.link !== undefined) data.link = body.link;
        if (body.description !== undefined) data.description = body.description;
        if (body.observations !== undefined) data.observations = body.observations;
        if (body.whereToIssue !== undefined) data.whereToIssue = body.whereToIssue;
        if (body.fileData !== undefined) data.fileData = body.fileData;
        if (body.fileName !== undefined) data.fileName = body.fileName;
        if (body.fileSize !== undefined) data.fileSize = body.fileSize;
        if (body.companyId !== undefined) data.companyId = body.companyId;
        if (body.attachments !== undefined) data.attachments = body.attachments;
        if (body.trashed !== undefined) data.trashed = body.trashed;
        if (body.trashedAt !== undefined) data.trashedAt = body.trashedAt ? new Date(body.trashedAt) : null;

        const doc = await prisma.companyDocument.update({
            where: { id: req.params.id as string },
            data
        });

        // Sync updates or deletions
        if (doc.trashed) {
            deleteEventFromGoogle(doc.id).catch(err => console.error("Document background sync delete failed:", err));
        } else if (doc.expirationDate) {
            pushEventToGoogle({
                summary: `[Doc] ${doc.title}`,
                description: `*[Gerado pelo Polaryon]*\n\nEste documento tem vencimento programado.\nTipo: ${doc.type}`,
                start: { date: new Date(doc.expirationDate).toISOString().split('T')[0] },
                end: { date: new Date(doc.expirationDate).toISOString().split('T')[0] }
            }, doc.id).catch(err => console.error("Document background sync update failed:", err));
        }

        res.json(doc);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/company/:id', async (req: Request, res: Response) => {
    try {
        await prisma.companyDocument.delete({
            where: { id: req.params.id as string }
        });

        // Cleanup Google Calendar
        deleteEventFromGoogle(req.params.id as string).catch(err => console.error("Document background sync cleanup failed:", err));

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// ESSENTIAL DOCUMENTS (MODELS)
// ==========================================

router.get('/essential', async (req: Request, res: Response) => {
    try {
        const models = await prisma.essentialDocument.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(models);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/essential', async (req: Request, res: Response) => {
    try {
        const doc = await prisma.essentialDocument.create({ data: req.body });
        res.json(doc);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/essential/:id', async (req: Request, res: Response) => {
    try {
        const doc = await prisma.essentialDocument.update({
            where: { id: req.params.id as string },
            data: req.body
        });
        res.json(doc);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/essential/:id', async (req: Request, res: Response) => {
    try {
        await prisma.essentialDocument.delete({
            where: { id: req.params.id as string }
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
