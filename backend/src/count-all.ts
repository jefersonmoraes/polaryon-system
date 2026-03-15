import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://polaryon:Jaguar2018jolela%23@204.168.151.231:5432/polaryon_db?schema=public"
        }
    }
});

async function main() {
    const tables = [
        'user', 'folder', 'board', 'kanbanList', 'card', 'company', 
        'budget', 'notification', 'companyDocument', 'essentialDocument', 
        'attachment', 'timeEntry', 'comment', 'milestone'
    ];
    
    console.log("--- Table Counts ---");
    for (const table of tables) {
        try {
            const count = await (prisma as any)[table].count();
            console.log(`${table}: ${count}`);
        } catch (e) {
            console.log(`${table}: Error or Not Found`);
        }
    }
}

main().finally(() => prisma.$disconnect());
