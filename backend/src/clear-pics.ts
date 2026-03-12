import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://polaryon:Jaguar2018jolela%23@204.168.151.231:5432/polaryon_db?schema=public"
        }
    }
});

async function main() {
    console.log("Connecting to production DB to check large pictures...");
    const users = await prisma.user.findMany();
    
    for (const user of users) {
        if (user.picture && user.picture.length > 100) {
            console.log(`User ${user.email} has picture of length: ${user.picture.length}`);
        } else {
            console.log(`User ${user.email} has no picture or very short one: ${user.picture ? user.picture.length : 0}`);
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
