const { PrismaClient } = require('@prisma/client');
// We need to resolve the database URL properly. 
// Since we are running outside backend directory, we can temporarily set process.env.DATABASE_URL
process.env.DATABASE_URL = "postgresql://polaryon:Jaguar2018jolela%23@204.168.151.231:5432/polaryon_db?schema=public";

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Fetching main companies...');
        const mainCompanies = await prisma.mainCompanyProfile.findMany();
        console.log('--- Main Companies ---');
        mainCompanies.forEach(c => {
            console.log({
                id: c.id,
                cnpj: c.cnpj,
                razaoSocial: c.razaoSocial,
                nomeFantasia: c.nomeFantasia,
                state: c.state,
                porte: c.porte,
                taxRegime: c.taxRegime,
                pis: c.pis,
                cofins: c.cofins,
                csll: c.csll,
                irpj: c.irpj,
                cpp: c.cpp,
                iss: c.iss,
                icms: c.icms,
                ipi: c.ipi
            });
        });

        console.log('\nFetching suppliers...');
        const companies = await prisma.company.findMany({
            where: { type: 'Fornecedor', trashed: false }
        });
        console.log('--- Suppliers ---');
        companies.forEach(c => {
            console.log({
                id: c.id,
                cnpj: c.cnpj,
                razao_social: c.razao_social,
                nome_fantasia: c.nome_fantasia,
                nickname: c.nickname,
                uf: c.uf,
                municipio: c.municipio
            });
        });

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
