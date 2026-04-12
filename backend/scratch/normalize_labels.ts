import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const labels = await prisma.label.findMany();
    for (const label of labels) {
        if (label.name !== label.name.toUpperCase()) {
            console.log(`Updating label "${label.name}" to "${label.name.toUpperCase()}"`);
            await prisma.label.update({
                where: { id: label.id },
                data: { name: label.name.toUpperCase() }
            });
        }
    }
    console.log("Labels normalized to uppercase.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
