import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/sidebar-links?category=...
router.get('/', async (req: Request, res: Response) => {
    try {
        const { category } = req.query;
        const where: any = {};
        if (category) where.category = category as string;

        const links = await prisma.sidebarLink.findMany({
            where,
            orderBy: { createdAt: 'asc' }
        });
        res.json(links);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/sidebar-links
router.post('/', async (req: Request, res: Response) => {
    try {
        const { title, url, category, isFavorite } = req.body;
        if (!title || !url || !category) {
            return res.status(400).json({ error: 'Title, URL, and Category are required' });
        }

        const link = await prisma.sidebarLink.create({
            data: { title, url, category, isFavorite: !!isFavorite }
        });
        res.json(link);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/sidebar-links/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await prisma.sidebarLink.delete({
            where: { id: req.params.id as string }
        });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
