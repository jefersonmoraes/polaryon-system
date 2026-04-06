import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { requireAdmin } from '../middleware/auth-middleware';

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

router.get('/', async (req: any, res: Response) => {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 5000
        });
        res.json(logs);
    } catch (error) {
        console.error('Falha ao buscar audit logs:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    try {
        const log = await prisma.auditLog.create({
            data: req.body
        });
        res.json(log);
    } catch (error) {
        console.error('Erro ao salvar audit log (Falha não-bloqueante):', error);
        // We return 201 even on failure to prevent frontend crashes due to audit failures
        res.status(201).json({ success: false, message: 'Log skipped' });
    }
});

export default router;
