const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== Recuperação Profunda (AuditLog Search) ===");
    const targetId = 'c3802c5f-566d-44fa-9c95-5759c620d4a0';
    
    const logs = await prisma.auditLog.findMany({
        where: {
            OR: [
                { action: { contains: targetId } },
                { details: { contains: targetId } }
            ]
        },
        orderBy: { timestamp: 'desc' }
    });

    console.log(`Logs encontrados: ${logs.length}`);
    for (const log of logs) {
        console.log(`[${log.timestamp.toISOString()}] Accion: ${log.action}`);
        try {
            const data = JSON.parse(log.details);
            if (data.oldData && data.oldData.description) {
                console.log(">>> ENCONTRADA DESCRIÇÃO ANTIGA NO LOG! <<<");
                console.log(data.oldData.description);
                console.log("===========================================");
            }
            if (data.description && data.description.length > 0) {
                 console.log(">>> VALOR ATUAL NO LOG (possivelmente vazio):");
                 console.log(`'${data.description}'`);
            }
        } catch (e) {
            // console.log("Details (not JSON):", log.details.substring(0, 100));
        }
    }

    await prisma.$disconnect();
}
main();
