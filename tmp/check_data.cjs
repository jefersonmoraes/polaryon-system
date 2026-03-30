const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const cards = await prisma.card.findMany({
      include: { descriptionEntries: true }
    });
    const results = cards.map(c => ({
      id: c.id,
      title: c.title,
      desc: c.description ? c.description.substring(0, 50) + "..." : "null",
      entriesCount: c.descriptionEntries.length,
      entriesTexts: c.descriptionEntries.map(e => e.text.substring(0, 30) + "...")
    }));
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
