import { prisma } from '../lib/prisma';


export interface BiddingItem {
    itemId: string;
    valorAtual: number;
    ganhador: string;
}

export interface ItemStrategyConfig {
    mode: 'follower' | 'sniper' | 'cover';
    minPrice: number;
    decrementValue: number;
    decrementType: 'fixed' | 'percent';
}

export class BiddingStrategyEngine {
    /**
     * Avalia a situação de um item específico e decide se deve disparar um lance.
     */
    static evaluate(currentItem: any, config: ItemStrategyConfig, currentTime: number) {
        const { mode, minPrice, decrementValue, decrementType } = config;
        
        // Se eu já sou o ganhador, não faço nada
        if (currentItem.ganhador === 'Você') {
            return { action: 'hold', reason: 'Já ganhando. Aguardando.' };
        }

        // Se o valor atual já está abaixo do meu mínimo, paro
        if (currentItem.valorAtual <= minPrice) {
            return { action: 'stop', reason: 'Preço mínimo atingido.' };
        }

        let nextBid = 0;
        if (decrementType === 'fixed') {
            nextBid = currentItem.valorAtual - decrementValue;
        } else {
            nextBid = currentItem.valorAtual * (1 - decrementValue / 100);
        }

        nextBid = Math.round(nextBid * 100) / 100;
        if (nextBid < minPrice) nextBid = minPrice;


        // --- Lógica por Modo ---
        switch (mode) {
            case 'follower':
                return { action: 'bid', value: nextBid, reason: 'Seguindo concorrente.' };

            case 'sniper':
                // Se o portal informar o tempo restante (segundosParaEncerramento)
                const timeLeft = currentItem.tempoRestante; // Vindo da API Serpro
                const secondsToSnipe = 5; // Configurável futuramente

                if (timeLeft > 0 && timeLeft <= secondsToSnipe) {
                    return { action: 'bid', value: nextBid, reason: `Sniper disparado (T-${timeLeft}s).` };
                }
                
                return { action: 'hold', reason: timeLeft > 0 ? `Sniper aguardando (T-${timeLeft}s)...` : 'Sniper aguardando encerramento iminente...' };

            case 'cover':
                return { action: 'bid', value: nextBid, reason: 'Cobertura ativa.' };
                
            default:
                return { action: 'hold', reason: 'Sem estratégia definida.' };
        }
    }
}
