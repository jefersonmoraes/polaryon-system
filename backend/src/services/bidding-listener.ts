import axios from 'axios';
import { getSocketServer } from '../socket';
import { prisma } from '../lib/prisma';

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

                // 2. BUSCA DADOS REAIS NO SERPRO (MODO PÚBLICO / TRANSPARÊNCIA)
                // Nota: O número da compra no Serpro deve ter 9 dígitos (5 do número + 4 do ano)
                const paddedNum = String(numeroPregao).padStart(5, '0');
                const fullNumero = `${paddedNum}${session?.anoPregao || '2026'}`;
                const publicApiUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa-publico/backend/api/sala-disputa/uasg/${uasg}/dispensa/${fullNumero}/itens`;
                
                console.log(`[PBE] Sincronizando: ${publicApiUrl}`);

                let realItems: any[] = [];
                try {
                    const response = await axios.get(publicApiUrl, { timeout: 4000 });
                    if (response.data && Array.isArray(response.data)) {
                        realItems = response.data.map((item: any) => ({
                            itemId: String(item.sequencial),
                            valorAtual: item.melhorLance || item.valorEstimado || 0,
                            ganhador: item.situacao === 'Aberto' ? 'Em Disputa' : (item.melhorLance ? 'Concorrente' : 'Aguardando'),
                            status: item.situacao || 'Aberto',
                            descricao: item.descricao
                        }));
                    }
                } catch (apiErr: any) {
                    console.error(`[PBE] Falha ao buscar dados oficiais (Transparência): ${apiErr.message}`);
                    // Fallback para não quebrar a tela se a API do governo oscilar
                    return; 
                }

                if (realItems.length === 0) return;

                // 3. Evaluate Strategies for each real item
                realItems.forEach(item => {
                    const config: ItemStrategyConfig = itemsConfig[item.itemId] || {
                        mode: 'follower',
                        minPrice: 0.10,
                        decrementValue: 0.01,
                        decrementType: 'fixed'
                    };

                    const decision = BiddingStrategyEngine.evaluate(item, config);
                    
                    if (decision.action === 'bid') {
                        console.log(`[PBE] RECOMENDAÇÃO REAL: Item ${item.itemId} -> Lance de R$ ${decision.value} (${decision.reason})`);
                    }
                });
                
                // Emite os dados REAIS para o front-end
                if (io) {
                    io.to(`bidding_room_${sessionId}`).emit('biddingUpdate', {
                        timestamp: new Date().toISOString(),
                        uasg,
                        numeroPregao,
                        items: realItems
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
