const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findAttachment() {
    try {
        const targetId = '94079314-785c-451d-85ac-3b8ece747e89';
        const budget = await prisma.budget.findFirst({
            where: {
                title: { contains: '94/2026' }
            }
        });
        
        if (!budget) {
            console.log("Budget not found");
            return;
        }
        
        const items = budget.items || [];
        for (const item of items) {
            const att = (item.attachments || []).find(a => a.id === targetId);
            if (att) {
                console.log("FOUND ATTACHMENT IN ITEM:", item.id || item.companyName);
                console.log(JSON.stringify(att, null, 2));
                return;
            }
        }
        
        console.log("ATTACHMENT NOT FOUND IN ANY ITEM.");
        // Search globally if it's outside items
        console.log("Budget keys:", Object.keys(budget));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

findAttachment();
