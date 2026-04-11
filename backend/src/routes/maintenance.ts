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


const AUTHORIZED_WHITELIST = [
    'jefersonmoraes72@gmail.com',
    'joelisonbeltrao@gmail.com',
    'jjcorporation2018@gmail.com'
];

/**
 * DEEP PURGE OF UNAUTHORIZED USERS (V7.0.7)
 * Removes all User records and associated data if the email is not in the whitelist.
 * WARNING: This is a destructive operation.
 */
router.post('/purge-unauthorized', async (req, res) => {
    try {
        console.log('🧹 Starting Unauthorized User Purge...');

        // 1. Find all users NOT in the whitelist
        const unauthorizedUsers = await prisma.user.findMany({
            where: {
                email: {
                    notIn: AUTHORIZED_WHITELIST,
                    mode: 'insensitive'
                }
            },
            select: { id: true, email: true }
        });

        if (unauthorizedUsers.length === 0) {
            return res.json({ 
                success: true, 
                message: '✅ Nenhuma conta não autorizada encontrada. O sistema já está limpo.',
                purgedCount: 0
            });
        }

        const purgedEmails = unauthorizedUsers.map(u => u.email);
        console.log(`⚠️ Purging ${unauthorizedUsers.length} accounts:`, purgedEmails);

        // 2. Perform Cascade Purge for each user
        for (const user of unauthorizedUsers) {
            const userId = user.id;

            await prisma.$transaction([
                // Activity
                prisma.userActivity.deleteMany({ where: { userId } }),
                // Notifications
                prisma.notification.deleteMany({ where: { userId } }),
                // Audit Logs
                prisma.auditLog.deleteMany({ where: { userId } }),
                // Kanban Assignee
                prisma.card.updateMany({
                    where: { assignee: userId },
                    data: { assignee: null }
                }),
                // Budget Links
                prisma.budget.updateMany({
                    where: { userId },
                    data: { userId: null }
                }),
                // The User itself
                prisma.user.delete({ where: { id: userId } })
            ]);
        }

        res.json({ 
            success: true, 
            message: `🔥 Purga concluída! ${unauthorizedUsers.length} contas removidas.`,
            purgedList: purgedEmails
        });

    } catch (error: any) {
        console.error('❌ Purge Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
