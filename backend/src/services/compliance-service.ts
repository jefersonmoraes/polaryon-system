import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fetchCnpjStatus(cnpj: string): Promise<string | null> {
    try {
        const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 PolaryonSystem-Compliance/1.0'
            }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.descricao_situacao_cadastral;
    } catch {
        return null;
    }
}

export async function checkAllCompaniesCompliance() {
    console.log('🧐 [Compliance] Iniciando verificação periódica de CNPJs...');
    
    const companies = await prisma.company.findMany({
        where: { trashed: false }
    });

    for (const company of companies) {
        const currentStatus = await fetchCnpjStatus(company.cnpj);
        
        if (currentStatus && currentStatus !== company.descricao_situacao_cadastral) {
            console.log(`⚠️ [Compliance] Mudança de status detectada para ${company.razao_social}: ${company.descricao_situacao_cadastral} -> ${currentStatus}`);
            
            // Update company status
            await prisma.company.update({
                where: { id: company.id },
                data: { 
                    descricao_situacao_cadastral: currentStatus,
                    lastCnpjCheck: new Date()
                }
            });

            // Create notification if no longer active
            if (currentStatus !== 'ATIVA') {
                await prisma.notification.create({
                    data: {
                        title: `ALERTA DE COMPLIANCE: ${company.nome_fantasia || company.razao_social}`,
                        message: `A empresa está com status "${currentStatus}" na Receita Federal. Recomenda-se a exclusão imediata para evitar problemas fiscais.`,
                        type: 'warning',
                        read: false
                    }
                });
            }
        }
        
        // Wait 3s between companies to respect BrasilAPI limits
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('✅ [Compliance] Verificação concluída.');
}

// Schedule task: Every Sunday at 03:00 AM
// Pattern: minute hour dayOfMonth month dayOfWeek
export function initComplianceCron() {
    console.log('🕐 [Cron] Serviço de monitoramento semanal agendado (Domingo às 03:00)');
    cron.schedule('0 3 * * 0', () => {
        checkAllCompaniesCompliance();
    });
}
