const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    const models = await p.essentialDocument.findMany({ orderBy: { createdAt: 'asc' } });
    console.log('Total models:', models.length);
    
    const seen = new Map();
    const dupes = [];
    
    for (const m of models) {
        if (seen.has(m.title)) {
            dupes.push(m.id);
        } else {
            seen.set(m.title, m.id);
        }
    }
    
    console.log('Unique titles:', seen.size);
    console.log('Duplicates to delete:', dupes.length);
    
    if (dupes.length > 0) {
        await p.essentialDocument.deleteMany({ where: { id: { in: dupes } } });
        console.log('Deleted duplicates');
    }
    
    const remaining = await p.essentialDocument.findMany();
    console.log('Remaining:', remaining.length);
    
    await p.$disconnect();
})();
