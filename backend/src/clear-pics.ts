import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://polaryon:Jaguar2018jolela%23@204.168.151.231:5432/polaryon_db?schema=public"
        }
    }
});

async function main() {
    console.log("Connecting to production DB to clear all manual pictures...");
    
    const result = await prisma.user.updateMany({
        data: {
            picture: ''
        }
    });

    console.log(`Successfully cleared profile pictures for ${result.count} users. They will be repopulated from Google on next login.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
