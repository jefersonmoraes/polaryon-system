import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyze() {
  console.log('--- SYNC PAYLOAD ANALYSIS ---');
  
  const start = Date.now();
  
  const [
    folders, boards, lists, cards, companies, mainCompanies, routes, 
    budgets, notifications, usersDb, labels, companyDocs, essentialDocs, 
    certificates, accountingCategories, bankAccounts, accountingEntries, 
    recurringExpenses, invoices, bankTransactions, taxObligations, 
    accountingSettings, accountantExports, auditLogs
  ] = await Promise.all([
    prisma.folder.findMany(),
    prisma.board.findMany(),
    prisma.kanbanList.findMany(),
    prisma.card.findMany({
        select: {
            id: true, listId: true, title: true, position: true, assignee: true,
            dueDate: true, startDate: true, completed: true, archived: true,
            trashed: true, summary: true, createdAt: true, updatedAt: true, labels: true,
        }
    }),
    prisma.company.findMany(),
    prisma.mainCompanyProfile.findMany({ orderBy: { id: 'asc' } }),
    prisma.route.findMany(),
    prisma.budget.findMany({
        select: {
           id: true, title: true, status: true, type: true, totalValue: true,
           cardId: true, userId: true, createdAt: true, archived: true, trashed: true
        }
    }),
    prisma.notification.findMany({ take: 50, orderBy: { createdAt: 'desc' } }),
    prisma.user.findMany({
        where: { role: { notIn: ['disabled', 'pending'] } },
        select: { id: true, name: true, email: true, picture: true }
    }),
    prisma.label.findMany(),
    prisma.companyDocument.findMany(),
    prisma.essentialDocument.findMany(),
    prisma.certificate.findMany(),
    prisma.accountingCategory.findMany(),
    prisma.bankAccount.findMany(),
    prisma.accountingEntry.findMany({ take: 500, orderBy: { date: 'desc' } }),
    prisma.recurringExpense.findMany(),
    prisma.invoice.findMany({ take: 100, orderBy: { issueDate: 'desc' } }),
    prisma.bankTransaction.findMany({ take: 200, orderBy: { date: 'desc' } }),
    prisma.taxObligation.findMany(),
    prisma.accountingSettings.findMany(),
    prisma.accountantExport.findMany({ take: 20, orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 50 })
  ]);

  const end = Date.now();
  console.log(`Query time: ${end - start}ms`);

  const data: any = {
    folders, boards, lists, cards, companies, mainCompanies, routes, budgets,
    notifications, members: usersDb, labels, companyDocs, essentialDocs,
    certificates, accounting: {
        categories: accountingCategories,
        accounts: bankAccounts,
        entries: accountingEntries,
        expenses: recurringExpenses,
        invoices,
        transactions: bankTransactions,
        taxes: taxObligations,
        settings: accountingSettings,
        exports: accountantExports
    },
    auditLogs
  };

  for (const key in data) {
    const size = Buffer.byteLength(JSON.stringify(data[key]), 'utf8');
    const count = Array.isArray(data[key]) ? data[key].length : 'N/A';
    console.log(`${key.padEnd(20)}: ${count.toString().padEnd(6)} items | ${(size / 1024).toFixed(2).padStart(8)} KB`);
  }

  const totalSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
  console.log('------------------------------');
  console.log(`TOTAL PAYLOAD SIZE: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
}

analyze().finally(() => prisma.$disconnect());
