import axios from 'axios';
import { getSocketServer } from '../socket';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// In Etapa 4 we will use mutual TLS with the A1 certificate here
const apiClient = axios.create({
    baseURL: 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-sala-disputa-fornecedor/api', // Mobile API endpoint usually provides faster JSON responses
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
        
        // Simulação do loop de Polling (Em prod, será 1s a 3s dependendo do rate limit do Serpro)
        const io = getSocketServer();
        
        const intervalId = setInterval(async () => {
            try {
                // TODO: Adicionar cabeçalho de Autenticação real (Token JWT ou Cookie) proveniente da Etapa 4
                // const response = await apiClient.get(`/pregao/${uasg}${numeroPregao}/itens`);
                
                // --- MOCK TEMPORÁRIO PARA VALIDAÇÃO DA ETAPA 2 (SEMÁFORO) ---
                // Para demonstrar o semáforo antes de plugar o login real da etapa 4
                const mockLances = [
                    { itemId: '1', valorAtual: (Math.random() * 10) + 90, ganhador: (Math.random() > 0.5 ? 'Você' : 'Concorrente X'), status: 'Aberto' },
                    { itemId: '2', valorAtual: (Math.random() * 5) + 40, ganhador: 'Você', status: 'Aberto' }
                ];
                
                // Emite os dados frescos para o front-end na 'sala' do pregão
                if (io) {
                    io.to(`bidding_room_${sessionId}`).emit('biddingUpdate', {
                        timestamp: new Date().toISOString(),
                        uasg,
                        numeroPregao,
                        items: mockLances
                    });
                }
                
            } catch (error: any) {
                console.error(`[PBE] Erro no polling da sessão ${sessionId}: ${error.message}`);
                // Adicionar lógica de backoff / retry aqui para não ser banido
            }
        }, 3000); // Poll a cada 3 segundos na simulação

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
