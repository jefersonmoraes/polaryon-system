const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyze() {
  console.log('--- Database Record Analysis ---');
  
  const cards = await prisma.card.findMany({ include: { attachments: true } });
  const budgets = await prisma.budget.findMany();
  const companies = await prisma.company.findMany();
  const logs = await prisma.auditLog.findMany({ take: 200, orderBy: { createdAt: 'desc' } });
  
  const cardSize = JSON.stringify(cards).length;
  const budgetSize = JSON.stringify(budgets).length;
  const companySize = JSON.stringify(companies).length;
  const logSize = JSON.stringify(logs).length;
  
  console.log(`Cards (${cards.length}): ${(cardSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Budgets (${budgets.length}): ${(budgetSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Companies (${companies.length}): ${(companySize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Audit Logs (Latest 200): ${(logSize / 1024 / 1024).toFixed(2)} MB`);
  
  // check for massive individual fields
  let maxCardDescSize = 0;
  cards.forEach(c => {
    if (c.description && c.description.length > maxCardDescSize) maxCardDescSize = c.description.length;
  });
  console.log(`Max Card Description Size: ${(maxCardDescSize / 1024).toFixed(2)} KB`);

  process.exit(0);
}

analyze().catch(e => {
  console.error(e);
  process.exit(1);
});
