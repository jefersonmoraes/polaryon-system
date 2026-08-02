const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const mainCompanies = await prisma.mainCompanyProfile.findMany();
        console.log('=== MAIN_COMPANIES ===');
        console.log(JSON.stringify(mainCompanies, null, 2));

        const companies = await prisma.company.findMany({
            where: { type: 'Fornecedor', trashed: false }
        });
        console.log('=== SUPPLIERS ===');
        console.log(JSON.stringify(companies, null, 2));

        const budgets = await prisma.budget.findMany({
            where: { trashed: false }
        });
        console.log('=== BUDGETS ===');
        console.log(JSON.stringify(budgets, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
