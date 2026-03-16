import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🧹 Iniciando limpeza de empresas inativas...");

    const companiesBefore = await prisma.company.count();
    
    // Remove companies where status is not ATIVA
    const deleteResult = await prisma.company.deleteMany({
        where: {
            descricao_situacao_cadastral: {
                not: 'ATIVA'
            }
        }
    });

    const companiesAfter = await prisma.company.count();

    console.log(`
📊 Resultado da Limpeza:
- Empresas no banco antes: ${companiesBefore}
- Empresas removidas: ${deleteResult.count}
- Empresas restantes (todas ATIVAS): ${companiesAfter}
    `);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
