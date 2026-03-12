import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://polaryon:Jaguar2018jolela%23@204.168.151.231:5432/polaryon_db?schema=public"
        }
    }
});

async function main() {
    console.log("Connecting to production DB to clear large pictures...");
    const users = await prisma.user.findMany();
    let clearedCount = 0;
    
    for (const user of users) {
        if (user.picture && user.picture.length > 5000) {
            console.log(`Clearing giant picture for user: ${user.email} (length: ${user.picture.length})`);
            await prisma.user.update({
                where: { id: user.id },
                data: { picture: '' }
            });
            clearedCount++;
        }
    }
    
    console.log(`Cleared ${clearedCount} large pictures successfully.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
