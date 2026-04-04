import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const totalDocs = await prisma.companyDocument.count();
    const trashedDocs = await prisma.companyDocument.count({ where: { trashed: true } });
    const docs = await prisma.companyDocument.findMany({
        select: { id: true, title: true, trashed: true }
    });

    console.log(`Total CompanyDocuments: ${totalDocs}`);
    console.log(`Trashed: ${trashedDocs}`);
    console.log('List:');
    docs.forEach(d => console.log(`- [${d.trashed ? 'T' : ' '}] ${d.title}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
