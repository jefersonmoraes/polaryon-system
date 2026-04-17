import { prisma } from '../lib/prisma';


export interface BiddingItem {
    itemId: string;
    valorAtual: number;
    ganhador: string;
}

export interface ItemStrategyConfig {
    mode: 'follower' | 'sniper' | 'cover' | 'shadow';
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
        // v2.2: Blindagem extra. Mesmo que o status diga ganhador, conferimos se o valor atual 
        // ainda é compatível com o último lance conhecido (implementação futura de persistência de lances)
        if (currentItem.ganhador === 'Você') {
            return { action: 'hold', reason: 'Já ganhando. Aguardando.' };
        }

        // Se o valor atual já está abaixo do meu mínimo, paro
        if (currentItem.valorAtual <= minPrice) {
            return { action: 'stop', reason: 'Preço mínimo atingido.' };
        }

        // --- LÓGICA DE HUMANIZAÇÃO (Random Delay) ---
        // Em um sistema real, o disparador (Listener) usaria este delay.
        // Aqui apenas indicamos se a ação é imediata ou deve esperar.

        let nextBid = 0;
        if (decrementType === 'fixed') {
            nextBid = currentItem.valorAtual - decrementValue;
        } else {
            nextBid = currentItem.valorAtual * (1 - decrementValue / 100);
        }

        nextBid = Math.round(nextBid * 100) / 100;
        if (nextBid < minPrice) nextBid = minPrice;

        const isImminente = currentItem.status?.toUpperCase().includes('IMINENTE') || 
                           (currentItem.tempoRestante > 0 && currentItem.tempoRestante < 60);


        // --- Lógica por Modo ---
        switch (mode) {
            case 'follower':
                // No modo seguidor, se estiver iminente, podemos ser mais agressivos
                const followerReason = isImminente ? 'Seguindo concorrente (FASE IMINENTE).' : 'Seguindo concorrente.';
                return { action: 'bid', value: nextBid, reason: followerReason };

            case 'sniper':
                // Sniper monitora o tempo restante (segundosParaEncerramento)
                const timeLeft = currentItem.tempoRestante; 
                const secondsToSnipe = 3; // Reduzido para 3s para precisão militar

                if (timeLeft > 0 && timeLeft <= secondsToSnipe) {
                    return { action: 'bid', value: nextBid, reason: `Sniper disparado (T-${timeLeft}s).` };
                }
                
                if (isImminente && timeLeft === -1) {
                    // Se estiver iminente mas sem cronômetro, sniper assume posição de prontidão
                    return { action: 'hold', reason: 'Sniper em prontidão (Fase Iminente).' };
                }
                
                return { action: 'hold', reason: timeLeft > 0 ? `Sniper aguardando (T-${timeLeft}s)...` : 'Sniper aguardando encerramento/fase iminente...' };

            case 'shadow':
                // Tenta se manter em 2º lugar (na cola do 1º)
                // Se eu já for o 2º, mantenho a posição.
                if (currentItem.position === 2) {
                    return { action: 'hold', reason: 'Modo Sombra: Mantendo 2º lugar.' };
                }
                
                // Se eu for 3º ou pior, tento subir para 2º. 
                // Para isso, calculamos um lance que fique ligeiramente ACIMA do 1º lugar atual, 
                // mas que seja o melhor lance entre os perdedores.
                // Simplificação: nextBid (um passo abaixo do 1º) nos coloca tecnicamente como 2º 
                // se ninguém mais der lance entre o 1º e nós.
                return { action: 'bid', value: nextBid, reason: 'Modo Sombra: Buscando 2º lugar.' };

            case 'cover':
                // Modo Cobertura é agressivo: sempre tenta o 1º lugar imediatamente.
                return { action: 'bid', value: nextBid, reason: 'Modo Cobertura: Retomando 1º lugar.' };
                
            default:
                return { action: 'hold', reason: 'Sem estratégia definida.' };
        }
    }
}
