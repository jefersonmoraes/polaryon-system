import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://polaryon:Jaguar2018jolela%23@204.168.151.231:5432/polaryon_db?schema=public"
        }
    }
});

async function main() {
    const users = await prisma.user.findMany({
        where: { email: { in: ['jefersonmoraes72@gmail.com', 'jjcorporation2018@gmail.com'] } }
    });
    console.log("Database user objects:", JSON.stringify(users.map(user => ({ ...user, picture: user.picture ? `[BASE64 SIZE: ${user.picture.length}]` : null })), null, 2));
    
    // Also simulate the exact query from kanban/sync
    const allUsers = await prisma.user.findMany({
        where: { role: { notIn: ['disabled', 'pending'] } }
    });
    console.log("Users in kanban sync:", allUsers.map(u => u.email).join(', '));
}

main().finally(() => prisma.$disconnect());
