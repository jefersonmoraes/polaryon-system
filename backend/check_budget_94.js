const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBudget() {
    try {
        const budget = await prisma.budget.findFirst({
            where: {
                title: {
                    contains: '94/2026'
                }
            }
        });
        
        if (!budget) {
            console.log("No budget found with 94/2026");
            return;
        }
        
        console.log("Budget ID:", budget.id);
        console.log("Full items structure:");
        console.log(JSON.stringify(budget.items, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkBudget();
