import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * EMERGENCY MAINTENANCE ROUTE (V7.0.6)
 * Forces the creation of the UserActivity table if it doesn't exist.
 * This bypasses the need for external 'prisma db push' which may be blocked by firewall.
 */
router.get('/sync-db', async (req, res) => {
    try {
        console.log('👷 Forced Database Sync: Creating UserActivity table...');
        
        // Raw SQL for PostgreSQL compatibility
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "UserActivity" (
                "id" TEXT NOT NULL,
                "userId" TEXT NOT NULL,
                "date" TIMESTAMP(3) NOT NULL,
                "duration" INTEGER NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL,
                CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
            );
        `);

        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UserActivity_userId_date_key" ON "UserActivity"("userId", "date");
        `);

        res.json({ 
            success: true, 
            message: '🚀 Tabela UserActivity sincronizada com sucesso no servidor!',
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('❌ Database Sync Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
