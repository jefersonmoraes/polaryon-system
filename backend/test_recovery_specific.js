const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== Buscando Logs de Auditoria para Recuperação (CARD c380) ===");
    const targetId = 'c3802c5f-566d-44fa-9c95-5759c620d4a0';
    
    // Find all logs for this card
    const logs = await prisma.auditLog.findMany({
        where: {
            OR: [
                { action: { contains: targetId } },
                { details: { contains: targetId } }
            ]
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    console.log(`Encontrados ${logs.length} logs.`);
    for (const log of logs) {
        console.log(`[${log.createdAt.toISOString()}] ${log.action}`);
        if (log.details) {
            try {
                const details = JSON.parse(log.details);
                if (details.description && details.description.length > 5) {
                    console.log("!!! POSSÍVEL DESCRIÇÃO ENCONTRADA NO LOG !!!");
                    console.log(details.description);
                    console.log("------------------------------------------");
                } else if (details.oldData && details.oldData.description) {
                     console.log("!!! DESCRIÇÃO ANTIGA ENCONTRADA (oldData) !!!");
                     console.log(details.oldData.description);
                     console.log("------------------------------------------");
                }
            } catch (e) {
                // If not JSON, just print start
                console.log(`Raw Details (start): ${log.details.substring(0, 100)}...`);
            }
        }
    }

    await prisma.$disconnect();
}
main();
