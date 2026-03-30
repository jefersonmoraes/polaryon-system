const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ids = [
        'c3802c5f-566d-44fa-9c95-5759c620d4a0',
        '8c9739ac-a9b3-428d-9100-d91f16e5f8ea',
        'c669de39-e94c-4a13-b744-f823cc86e072'
    ];
    
    for (const id of ids) {
        const card = await prisma.card.findUnique({ where: { id } });
        console.log(`ID: ${id}`);
        console.log(`Title: ${card?.title}`);
        console.log(`Description: ${card?.description ? card.description.substring(0, 100) + '...' : 'EMPTY/NULL'}`);
        console.log('---');
    }
    await prisma.$disconnect();
}
main();
