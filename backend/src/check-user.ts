import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://polaryon:Jaguar2018jolela%23@204.168.151.231:5432/polaryon_db?schema=public"
        }
    }
});

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'jefersonmoraes72@gmail.com' }
    });
    console.log("Database user object:", JSON.stringify(user ? { ...user, picture: user.picture ? `[BASE64 SIZE: ${user.picture.length}]` : null } : null, null, 2));
    
    // Also simulate the exact query from kanban/sync
    const users = await prisma.user.findMany({
        where: { role: { notIn: ['disabled', 'pending'] } }
    });
    console.log("Users in kanban sync:", users.map(u => u.email).join(', '));
}

main().finally(() => prisma.$disconnect());
