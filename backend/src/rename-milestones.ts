import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://polaryon:Jaguar2018jolela%23@localhost:5432/polaryon_db?schema=public"
        }
    }
});

async function main() {
    console.log("🚀 Starting Milestone Migration: 'DATA E HORA DOS LANCES' -> 'LANCES'...");
    
    const result = await prisma.milestone.updateMany({
        where: {
            title: "DATA E HORA DOS LANCES"
        },
        data: {
            title: "LANCES"
        }
    });

    console.log(`✅ Success! Updated ${result.count} milestones.`);
}

main()
    .catch(e => {
        console.error("❌ Migration failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
