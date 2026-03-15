
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Audit (EXTENDED) ---');
  
  const models = [
    'user', 'company', 'folder', 'board', 'kanbanList', 'card', 'attachment', 
    'mainCompanyProfile', 'companyDocument', 'essentialDocument', 'budget',
    'notification'
  ];

  for (const model of models) {
    try {
      const count = await (prisma as any)[model].count();
      console.log(`Table: ${model} - Count: ${count}`);
      if (count > 0) {
        const samples = await (prisma as any)[model].findMany({ take: 3 });
        console.log(`Samples for ${model}:`, JSON.stringify(samples, null, 2));
      }
    } catch (e: any) {
      console.log(`Table: ${model} - Error: ${e.message}`);
    }
  }

  const allCards = await prisma.card.findMany({ select: { title: true, id: true } });
  console.log('\n--- All Cards ---');
  console.log(JSON.stringify(allCards, null, 2));

  process.exit(0);
}

main();
