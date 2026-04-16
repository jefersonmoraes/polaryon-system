import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = express.Router();

// GET current radar settings
router.get('/settings', async (req: Request, res: Response) => {
    try {
        const profile = await prisma.mainCompanyProfile.findFirst({ where: { isDefault: true } });
        res.json({
            keywords: profile?.radarKeywords || [],
            states: profile?.radarStates || []
        });
    } catch (error) {
        console.error('Erro ao buscar configurações do radar:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// POST update radar settings
router.post('/settings', async (req: Request, res: Response) => {
    const { keywords, states } = req.body;
    try {
        const profile = await prisma.mainCompanyProfile.findFirst({ where: { isDefault: true } });
        if (!profile) {
            return res.status(404).json({ error: 'Perfil da empresa não encontrado' });
        }

        const updated = await prisma.mainCompanyProfile.update({
            where: { id: profile.id },
            data: {
                radarKeywords: keywords,
                radarStates: states
            }
        });

        res.json({
            keywords: updated.radarKeywords,
            states: updated.radarStates
        });
    } catch (error) {
        console.error('Erro ao salvar configurações do radar:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

export default router;
