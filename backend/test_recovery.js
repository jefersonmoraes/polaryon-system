const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== Buscando Logs de Auditoria para Recuperação ===");
    const targetId = 'c3802c5f-566d-44fa-9c95-5759c620d4a0';
    
    const logs = await prisma.auditLog.findMany({
        where: {
            OR: [
                { action: { contains: targetId } },
                { details: { contains: targetId } },
                { action: { contains: 'description' } }
            ]
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    console.log(`Encontrados ${logs.length} logs.`);
    logs.forEach(log => {
        console.log(`[${log.createdAt.toISOString()}] ${log.action}`);
        if (log.details && log.details.length > 5) {
            console.log(`Details: ${log.details.substring(0, 200)}...`);
        }
    });

    await prisma.$disconnect();
}
main();
