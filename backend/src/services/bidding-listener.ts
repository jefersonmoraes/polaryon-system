import axios from 'axios';
import { getSocketServer } from '../socket';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

import { BiddingStrategyEngine, ItemStrategyConfig } from './bidding-strategy-engine';

// In Etapa 4 we will use mutual TLS with the A1 certificate here
const apiClient = axios.create({
    baseURL: 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-sala-disputa-fornecedor/api', 
    timeout: 5000,
    headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

interface PollingJob {
    sessionId: string;
    intervalId: NodeJS.Timeout;
}

export class BiddingListener {
    private static activeJobs: Map<string, PollingJob> = new Map();

    /**
     * Inicia o radar de monitoramento para uma sessão específica
     */
    static async startMonitoring(sessionId: string, uasg: string, numeroPregao: string) {
        if (this.activeJobs.has(sessionId)) {
            console.log(`[PBE] Listener já ativo para sessão ${sessionId}`);
            return;
        }

        console.log(`[PBE] Iniciando Radar (Listener) para UASG: ${uasg} / Pregão: ${numeroPregao}`);
        
        // Simulação do loop de Polling
        const io = getSocketServer();
        
        const intervalId = setInterval(async () => {
            try {
                // 1. Fetch current session to get strategy configs
                const session = await prisma.biddingSession.findUnique({ where: { id: sessionId } });
                const itemsConfig = (session?.itemsConfig as any) || {};

                // --- MOCK TEMPORÁRIO PARA VALIDAÇÃO (SEMÁFORO E ESTRATÉGIA) ---
                const mockItems = [
                    { itemId: '1', valorAtual: 95.50, ganhador: (Math.random() > 0.7 ? 'Você' : 'Concorrente X'), status: 'Aberto' },
                    { itemId: '2', valorAtual: 42.00, ganhador: 'Você', status: 'Aberto' }
                ];

                // 2. Evaluate Strategies for each item
                mockItems.forEach(item => {
                    const config: ItemStrategyConfig = itemsConfig[item.itemId] || {
                        mode: 'follower',
                        minPrice: 80.00,
                        decrementValue: 0.10,
                        decrementType: 'fixed'
                    };

                    const decision = BiddingStrategyEngine.evaluate(item, config);
                    
                    if (decision.action === 'bid') {
                        console.log(`[PBE] RECOMENDAÇÃO: Item ${item.itemId} -> Lance de R$ ${decision.value} (${decision.reason})`);
                        // Etapa 4: Enviar lance real aqui
                    }
                });
                
                // Emite os dados frescos para o front-end
                if (io) {
                    io.to(`bidding_room_${sessionId}`).emit('biddingUpdate', {
                        timestamp: new Date().toISOString(),
                        uasg,
                        numeroPregao,
                        items: mockItems
                    });
                }
                
            } catch (error: any) {
                console.error(`[PBE] Erro no polling da sessão ${sessionId}: ${error.message}`);
            }
        }, 3000); 


        this.activeJobs.set(sessionId, { sessionId, intervalId });

        // Update DB status
        await prisma.biddingSession.update({
            where: { id: sessionId },
            data: { sessionStatus: 'active' }
        });
    }

    /**
     * Desliga o radar
     */
    static async stopMonitoring(sessionId: string) {
        const job = this.activeJobs.get(sessionId);
        if (job) {
            clearInterval(job.intervalId);
            this.activeJobs.delete(sessionId);
            console.log(`[PBE] Radar desligado para sessão ${sessionId}`);

            await prisma.biddingSession.update({
                where: { id: sessionId },
                data: { sessionStatus: 'paused' }
            });
        }
    }

    static getActiveJobsCount() {
        return this.activeJobs.size;
    }
}
