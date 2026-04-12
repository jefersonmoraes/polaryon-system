const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const boards = await prisma.board.findMany();
  for (const b of boards) {
      console.log(b.id, b.name);
      if (b.name === '~]ç') {
          console.log('Found it! Archiving/trashing or deleting it...');
          await prisma.board.update({
              where: { id: b.id },
              data: { trashed: true, trashedAt: new Date() }
          });
      }
  }
}
run().then(() => prisma.$disconnect());
