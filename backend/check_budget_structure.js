const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBudget() {
    try {
        const budget = await prisma.budget.findFirst({
            where: {
                trashed: false
            }
        });
        
        if (!budget) {
            console.log("No budget found");
            return;
        }
        
        console.log("Budget ID:", budget.id);
        console.log("Items structure (first item):");
        const items = budget.items || [];
        if (items.length > 0) {
            const firstItem = items[0];
            console.log(JSON.stringify({
                name: firstItem.name,
                attachments: firstItem.attachments
            }, null, 2));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkBudget();
