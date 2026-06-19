import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth-middleware';

const router = Router();

function qs(val: unknown): string | undefined {
    return typeof val === 'string' ? val : undefined;
}

function ps(val: unknown): string {
    return String(val);
}

/**
 * GET /api/competitive-intelligence/profiles
 */
router.get('/profiles', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const purchaseId = qs(req.query.purchaseId);
        const itemId = qs(req.query.itemId);
        const minAggressiveScore = qs(req.query.minAggressiveScore);
        const limit = qs(req.query.limit);

        const where: any = {};
        if (minAggressiveScore) {
            where.aggressiveScore = { gte: Number(minAggressiveScore) };
        }

        const profiles = await prisma.competitorProfile.findMany({
            where,
            orderBy: { aggressiveScore: 'desc' },
            take: limit ? Number(limit) : 50
        });

        if (purchaseId && itemId) {
            const activeParticipants = await prisma.bidHistory.findMany({
                where: { purchaseId, itemId },
                distinct: ['participantId'],
                select: { participantId: true }
            });
            const activeIds = new Set(activeParticipants.map(p => p.participantId));
            return res.json(profiles.filter(p => activeIds.has(p.participantId)));
        }

        res.json(profiles);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/competitive-intelligence/profiles/:participantId
 */
router.get('/profiles/:participantId', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const participantId = ps(req.params.participantId);

        const profile = await prisma.competitorProfile.findUnique({
            where: { participantId }
        });

        if (!profile) {
            return res.status(404).json({ error: 'Concorrente não encontrado' });
        }

        const recentBids = await prisma.bidHistory.findMany({
            where: { participantId },
            orderBy: { observedAt: 'desc' },
            take: 50
        });

        const activeItems = await prisma.bidHistory.groupBy({
            by: ['purchaseId', 'itemId'],
            where: { participantId },
            _count: true,
            _max: { observedAt: true },
            orderBy: { _max: { observedAt: 'desc' } },
            take: 20
        });

        res.json({ ...profile, recentBids, activeItems });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/competitive-intelligence/history/:purchaseId/:itemId
 */
router.get('/history/:purchaseId/:itemId', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const purchaseId = ps(req.params.purchaseId);
        const itemId = ps(req.params.itemId);
        const limit = qs(req.query.limit);
        const since = qs(req.query.since);

        const where: any = { purchaseId, itemId };
        if (since) {
            where.observedAt = { gte: new Date(since) };
        }

        const bids = await prisma.bidHistory.findMany({
            where,
            orderBy: { observedAt: 'desc' },
            take: limit ? Number(limit) : 200
        });

        const stats = await prisma.bidHistory.aggregate({
            where: { purchaseId, itemId },
            _count: true,
            _min: { value: true },
            _max: { value: true },
            _avg: { value: true }
        });

        const participants = await prisma.bidHistory.groupBy({
            by: ['participantId'],
            where: { purchaseId, itemId },
            _count: true,
            _min: { value: true },
            orderBy: { _min: { value: 'asc' } }
        });

        res.json({
            bids,
            stats: {
                totalBids: stats._count,
                lowestValue: stats._min?.value ?? null,
                highestValue: stats._max?.value ?? null,
                avgValue: stats._avg?.value ? Math.round(stats._avg.value * 100) / 100 : null
            },
            participants: participants.map(p => ({
                participantId: p.participantId,
                bidCount: p._count,
                lowestBid: p._min?.value ?? null
            }))
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/competitive-intelligence/war-history/:purchaseId
 */
router.get('/war-history/:purchaseId', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const purchaseId = ps(req.params.purchaseId);

        const rounds = await prisma.auctionRound.findMany({
            where: { purchaseId },
            orderBy: { observedAt: 'desc' },
            take: 100
        });

        const warRounds = rounds.filter(r => r.wasWarRound);

        res.json({
            totalRounds: rounds.length,
            warRounds: warRounds.length,
            rounds: rounds.slice(0, 50)
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/competitive-intelligence/results
 */
router.get('/results', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const purchaseId = qs(req.query.purchaseId);
        const limit = qs(req.query.limit);

        const where: any = {};
        if (purchaseId) where.purchaseId = purchaseId;

        const results = await prisma.auctionResult.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit ? Number(limit) : 20
        });

        res.json(results);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/competitive-intelligence/stats
 */
router.get('/stats', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const [totalBids, totalProfiles, totalRounds, totalResults, recentBids] =
            await Promise.all([
                prisma.bidHistory.count(),
                prisma.competitorProfile.count(),
                prisma.auctionRound.count(),
                prisma.auctionResult.count(),
                prisma.bidHistory.count({
                    where: { observedAt: { gte: new Date(Date.now() - 86400000) } }
                })
            ]);

        const topAggressive = await prisma.competitorProfile.findMany({
            orderBy: { aggressiveScore: 'desc' },
            take: 10,
            select: {
                participantId: true,
                totalBids: true,
                aggressiveScore: true,
                avgReductionPerBid: true,
                avgTimeBetweenBids: true
            }
        });

        const topActive = await prisma.competitorProfile.findMany({
            orderBy: { totalBids: 'desc' },
            take: 10,
            select: {
                participantId: true,
                totalBids: true,
                aggressiveScore: true,
                bidCountLast10min: true
            }
        });

        res.json({
            totals: { bids: totalBids, profiles: totalProfiles, rounds: totalRounds, results: totalResults, bidsLast24h: recentBids },
            topAggressive,
            topActive
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /api/competitive-intelligence/history/:purchaseId/:itemId
 */
router.delete('/history/:purchaseId/:itemId', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const purchaseId = ps(req.params.purchaseId);
        const itemId = ps(req.params.itemId);

        const deleted = await prisma.bidHistory.deleteMany({
            where: { purchaseId, itemId }
        });

        res.json({ deleted: deleted.count });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
