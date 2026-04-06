import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get activity stats for all users (Admin only or all members can see each other?)
// Requirement says "na tela de Equipe", so it should be available.
router.get('/stats', async (req, res) => {
    try {
        const { period } = req.query; // 'day', 'week', 'month', 'year', 'all'
        
        const now = new Date();
        const startDate = new Date();
        let useFilter = true;
        
        if (period === 'day') {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'month') {
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'year') {
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'all') {
            useFilter = false;
        } else {
            // Default: Week
            const day = startDate.getDay();
            const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
            startDate.setDate(diff);
            startDate.setHours(0, 0, 0, 0);
        }

        const activities = await prisma.userActivity.findMany({
            where: useFilter ? {
                date: { gte: startDate }
            } : {}
        }).catch(() => []);

        // Group by userId
        const stats: Record<string, number> = {};
        activities.forEach(a => {
            if (!stats[a.userId]) stats[a.userId] = 0;
            stats[a.userId] += a.duration;
        });

        res.json({ success: true, stats });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
