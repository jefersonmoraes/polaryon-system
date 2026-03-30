const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== DIAGNÓSTICO PROFUNDO DE DADOS ===");
    
    // 1. Verificar cartões com descrições (confirmar se existem dados remanescentes)
    const cardsWithDesc = await prisma.card.findMany({
        where: { description: { not: null, not: '' } },
        select: { id: true, title: true, description: true }
    });
    console.log(`Cartões no banco com descrição: ${cardsWithDesc.length}`);
    cardsWithDesc.forEach(c => console.log(` - [${c.id}] ${c.title} (tamanho: ${c.description.length})`));

    // 2. Procurar por QUALQUER registro no log de auditoria que contenha contéudo de descrição (mais de 100 caracteres)
    console.log("\n=== BUSCANDO CONTEÚDO NOS LOGS DE AUDITORIA ===");
    const logs = await prisma.auditLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 500
    });
    
    let found = false;
    for (const log of logs) {
        if (log.details && log.details.length > 200) {
            console.log(`[${log.timestamp.toISOString()}] Log suspeito encontrado (${log.details.length} chars)`);
            if (log.details.includes('description') || log.details.includes('<')) {
                console.log("!!! CONTEÚDO POSSIVELMENTE ENCONTRADO !!!");
                console.log(log.details.substring(0, 1000));
                console.log("...");
                found = true;
            }
        }
    }
    if (!found) console.log("Nenhum log com conteúdo rico encontrado.");

    // 3. Verificar entradas residuais (órfãs)
    const entries = await prisma.cardDescriptionEntry.count();
    console.log(`\nEntradas de descrição remanescentes na tabela CardDescriptionEntry: ${entries}`);

    await prisma.$disconnect();
}
main();
