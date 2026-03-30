const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("=== Iniciando Migração Definitiva de Descrições ===");
        
        const cards = await prisma.card.findMany({
            include: { descriptionEntries: true }
        });

        for (const card of cards) {
            if (card.descriptionEntries.length > 0) {
                console.log(`Consolidando descrições para o cartão: ${card.title} (${card.id})`);
                
                // Sort entries by date
                const sortedEntries = card.descriptionEntries.sort((a, b) => 
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                
                // Consolidate text
                const consolidatedText = sortedEntries.map(e => e.text).join('<br/><hr/><br/>');
                
                // If the current description is null or different from consolidated, update it
                // We merge it if description already has someone's manual entry during the bug
                let finalText = consolidatedText;
                if (card.description && card.description.trim() !== "" && card.description !== consolidatedText) {
                    finalText = card.description + "<br/><br/><p>--- Histórico Consolidado ---</p><br/>" + consolidatedText;
                }

                await prisma.card.update({
                    where: { id: card.id },
                    data: { 
                        description: finalText,
                        // Clear entries to avoid duplicate consolidation later
                    }
                });

                // Optional: Delete entries to keep DB clean
                await prisma.cardDescriptionEntry.deleteMany({
                    where: { cardId: card.id }
                });
            }
        }

        console.log("=== Migração Concluída com Sucesso! ===");
    } catch (e) {
        console.error("Erro na migração:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
