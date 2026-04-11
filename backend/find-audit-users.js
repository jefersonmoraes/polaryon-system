const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findUsersFromLogs() {
    try {
        const logs = await prisma.auditLog.findMany({
            take: 100,
            orderBy: { timestamp: 'desc' },
            select: { userName: true, userId: true }
        });
        const uniqueUsers = Array.from(new Set(logs.map(l => l.userName)));
        console.log('AUDIT_USERS_START');
        console.log(JSON.stringify(uniqueUsers, null, 2));
        console.log('AUDIT_USERS_END');
    } catch (error) {
        console.error('Error fetching logs:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findUsersFromLogs();
