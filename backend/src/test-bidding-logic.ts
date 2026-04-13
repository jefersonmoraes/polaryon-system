import { BiddingStrategyEngine, BiddingItem, ItemStrategyConfig } from './services/bidding-strategy-engine';

/**
 * Script de Simulação Automatizada para Auditoria (Etapas 1-3)
 * Objetivo: Validar se o cérebro toma decisões corretas e seguras.
 */
function runInternalAudit() {
    console.log("--- [PBE] INICIANDO AUDITORIA INTERNA DO CÉREBRO ---");

    const testCases: { item: BiddingItem, config: ItemStrategyConfig, expected: string }[] = [
        {
            item: { itemId: '1', valorAtual: 100, ganhador: 'Concorrente' },
            config: { mode: 'follower', minPrice: 80, decrementValue: 5, decrementType: 'fixed' },
            expected: 'bid (95)'
        },
        {
            item: { itemId: '2', valorAtual: 82, ganhador: 'Concorrente' },
            config: { mode: 'follower', minPrice: 80, decrementValue: 5, decrementType: 'fixed' },
            expected: 'bid (80) - Não fura reserva'
        },
        {
            item: { itemId: '3', valorAtual: 79, ganhador: 'Concorrente' },
            config: { mode: 'follower', minPrice: 80, decrementValue: 5, decrementType: 'fixed' },
            expected: 'stop - Abaixo do reserva'
        },
        {
            item: { itemId: '4', valorAtual: 90, ganhador: 'Você' },
            config: { mode: 'follower', minPrice: 80, decrementValue: 5, decrementType: 'fixed' },
            expected: 'hold - Já ganhando'
        }
    ];

    testCases.forEach((t, i) => {
        const decision = BiddingStrategyEngine.evaluate(t.item, t.config, Date.now());
        console.log(`\nCaso #${i+1}: ${t.expected}`);
        console.log(`Resultado: ${decision.action} | Valor: ${decision.value || 'N/A'} | Motivo: ${decision.reason}`);
        
        // Assertions simples
        if (t.item.valorAtual <= t.config.minPrice && decision.action !== 'stop') {
             console.error("❌ FALHA: O robô deveria ter parado (Preço abaixo do mínimo).");
        }
        if (t.item.ganhador === 'Você' && decision.action !== 'hold') {
             console.error("❌ FALHA: O robô deveria segurar o lance (Já está ganhando).");
        }
        if (decision.action === 'bid' && decision.value! < t.config.minPrice) {
             console.error(`❌ FALHA CRÍTICA: Lance R$ ${decision.value} fura o preço reserva R$ ${t.config.minPrice}!`);
        }
    });

    console.log("\n--- [PBE] AUDITORIA CONCLUÍDA ---");
}

runInternalAudit();
