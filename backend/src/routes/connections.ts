import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// ==========================================
// FOLDERS
// ==========================================

// GET /api/connections/folders
router.get('/folders', async (req: Request, res: Response) => {
    try {
        const folders = await prisma.connectionFolder.findMany({
            include: { links: true },
            orderBy: { createdAt: 'asc' }
        });
        res.json(folders);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/connections/folders
router.post('/folders', async (req: Request, res: Response) => {
    try {
        const { name, color } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const folder = await prisma.connectionFolder.create({
            data: { name, color }
        });
        res.json(folder);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/connections/folders/:id
router.put('/folders/:id', async (req: Request, res: Response) => {
    try {
        const { name, color } = req.body;
        const folder = await prisma.connectionFolder.update({
            where: { id: String(req.params.id) },
            data: { name, color }
        });
        res.json(folder);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/connections/folders/:id
router.delete('/folders/:id', async (req: Request, res: Response) => {
    try {
        await prisma.connectionFolder.delete({
            where: { id: String(req.params.id) }
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// LINKS
// ==========================================

// POST /api/connections/links
router.post('/links', async (req: Request, res: Response) => {
    try {
        const { title, url, description, isFavorite, folderId } = req.body;
        if (!title || !url || !folderId) {
            return res.status(400).json({ error: 'Title, URL, and Folder ID are required' });
        }

        const link = await prisma.connectionLink.create({
            data: { 
                title, 
                url, 
                description, 
                isFavorite: !!isFavorite, 
                folderId 
            }
        });
        res.json(link);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/connections/links/:id
router.put('/links/:id', async (req: Request, res: Response) => {
    try {
        const { title, url, description, isFavorite, folderId } = req.body;
        const link = await prisma.connectionLink.update({
            where: { id: String(req.params.id) },
            data: { 
                title, 
                url, 
                description, 
                isFavorite: isFavorite !== undefined ? !!isFavorite : undefined, 
                folderId 
            }
        });
        res.json(link);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/connections/links/:id
router.delete('/links/:id', async (req: Request, res: Response) => {
    try {
        await prisma.connectionLink.delete({
            where: { id: String(req.params.id) }
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
