import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
     * @param currentItem Estado atual do item vindo do Radar
     * @param config Configuração de estratégia salva no banco
     */
    static evaluate(currentItem: BiddingItem, config: ItemStrategyConfig) {
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

        // Garante que o próximo lance não fure o mínimo
        if (nextBid < minPrice) {
            nextBid = minPrice;
        }

        // --- Lógica por Modo ---
        switch (mode) {
            case 'follower':
                // Reage imediatamente (a Etapa 2 já dispara este evento)
                return { action: 'bid', value: nextBid, reason: 'Seguindo concorrente.' };

            case 'sniper':
                // Sniper precisa do cronômetro. (A implementar na Etapa 4)
                // Por enquato apenas recomenda segurar
                return { action: 'hold', reason: 'Aguardando cronômetro (Modo Sniper).' };

            case 'cover':
                // Tenta sempre ser o primeiro. 
                return { action: 'bid', value: nextBid, reason: 'Cobertura ativa.' };
                
            default:
                return { action: 'hold', reason: 'Sem estratégia definida.' };
        }
    }
}
