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
        const trashed = req.query.trashed === 'true';
        const folders = await prisma.connectionFolder.findMany({
            where: trashed 
                ? { 
                    OR: [
                        { trashed: true },
                        { links: { some: { trashed: true } } }
                    ]
                }
                : { trashed: false },
            include: { 
                links: {
                    where: { trashed },
                    orderBy: { order: 'asc' }
                } 
            },
            orderBy: { order: 'asc' }
        });
        res.json(folders);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/connections/folders
router.post('/folders', async (req: Request, res: Response) => {
    try {
        const { name, color, parentId } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const folder = await prisma.connectionFolder.create({
            data: { name, color, parentId }
        });
        res.json(folder);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/connections/folders/:id
router.put('/folders/:id', async (req: Request, res: Response) => {
    try {
        const { name, color, parentId } = req.body;
        const folder = await prisma.connectionFolder.update({
            where: { id: String(req.params.id) },
            data: { name, color, parentId }
        });
        res.json(folder);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/connections/folders/:id/trash
router.put('/folders/:id/trash', async (req: Request, res: Response) => {
    try {
        await prisma.connectionFolder.update({
            where: { id: String(req.params.id) },
            data: { trashed: true, trashedAt: new Date() }
        });
        // Also trash all links in this folder
        await prisma.connectionLink.updateMany({
            where: { folderId: String(req.params.id) },
            data: { trashed: true, trashedAt: new Date() }
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/connections/folders/:id/restore
router.put('/folders/:id/restore', async (req: Request, res: Response) => {
    try {
        await prisma.connectionFolder.update({
            where: { id: String(req.params.id) },
            data: { trashed: false, trashedAt: null }
        });
        // Also restore all links in this folder
        await prisma.connectionLink.updateMany({
            where: { folderId: String(req.params.id) },
            data: { trashed: false, trashedAt: null }
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/connections/folders/reorder
router.put('/folders/reorder', async (req: Request, res: Response) => {
    try {
        const { folders } = req.body; // Array of { id: string, order: number }
        
        await Promise.all(
            folders.map((f: { id: string, order: number }) => 
                prisma.connectionFolder.update({
                    where: { id: f.id },
                    data: { order: f.order }
                })
            )
        );
        
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/connections/folders/:id/permanent
router.delete('/folders/:id/permanent', async (req: Request, res: Response) => {
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

// PUT /api/connections/links/:id/trash
router.put('/links/:id/trash', async (req: Request, res: Response) => {
    try {
        await prisma.connectionLink.update({
            where: { id: String(req.params.id) },
            data: { trashed: true, trashedAt: new Date() }
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/connections/links/:id/restore
router.put('/links/:id/restore', async (req: Request, res: Response) => {
    try {
        await prisma.connectionLink.update({
            where: { id: String(req.params.id) },
            data: { trashed: false, trashedAt: null }
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/connections/links/reorder
router.put('/links/reorder', async (req: Request, res: Response) => {
    try {
        const { links } = req.body; // Array of { id: string, order: number }
        
        await Promise.all(
            links.map((l: { id: string, order: number }) => 
                prisma.connectionLink.update({
                    where: { id: l.id },
                    data: { order: l.order }
                })
            )
        );
        
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
