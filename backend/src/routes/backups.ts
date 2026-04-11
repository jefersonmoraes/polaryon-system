import { Router, Request, Response } from 'express';
import { runBackup } from '../services/backup-service';
import { requireAdmin } from '../middleware/auth-middleware';
import fs from 'fs';
import path from 'path';

const router = Router();
const backupDir = path.join(__dirname, '../../backups');

export interface BackupStatus {
    fileName: string;
    sizeBytes: number;
    createdAt: Date;
    status: 'healthy' | 'error';
}

router.get('/', requireAdmin, (req: Request, res: Response) => {
    try {
        if (!fs.existsSync(backupDir)) {
            return res.json([]);
        }

        const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql'));
        const backups: BackupStatus[] = files.map(file => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            return {
                fileName: file,
                sizeBytes: stats.size,
                createdAt: stats.mtime,
                status: stats.size > 0 ? 'healthy' : 'error'
            };
        });

        // Ordenar do mais novo para o mais antigo
        backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        res.json(backups);
    } catch (e: any) {
        console.error('[Backup Route] Falha ao recuperar status de backups:', e);
        res.status(500).json({ error: 'Erro interno ao consultar backups' });
    }
});

// Endpoint opcional para forçar backup manualmente, util para testes.
router.post('/force', requireAdmin, async (req: Request, res: Response) => {
    try {
        await runBackup();
        res.json({ message: 'Backup concluído com sucesso.' });
    } catch (error: any) {
        res.status(500).json({ error: 'Falha ao forçar o backup.', details: error.message });
    }
});

export default router;
