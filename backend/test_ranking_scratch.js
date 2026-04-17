
const itemData = {
    "numero": 1,
    "melhorValorFornecedor": { "valorInformado": 10000, "valorCalculado": 1514 },
    "melhorValorGeral": { "valorInformado": 1514, "valorCalculado": 1514 },
    "posicaoParticipanteDisputa": "P"
};

function calculateGanhador(item) {
    const melhorMeu = item.melhorValorFornecedor ? item.melhorValorFornecedor.valorInformado : 0;
    const melhorGeral = item.melhorValorGeral ? item.melhorValorGeral.valorInformado : 0;
    
    console.log(`Comparando: Meu Informado(${melhorMeu}) vs Geral Informado(${melhorGeral})`);
    
    // Antiga lógica que está falhando (ou sendo suplantada pelo valorCalculado se algo mudar)
    const isWinnerPrice = melhorMeu > 0 && melhorMeu <= melhorGeral;

    // Nova lógica proposta: Confirmação por Posição se disponível
    let isWinnerPosition = false;
    if (item.posicaoParticipanteDisputa === '1' || item.posicaoParticipanteDisputa === 'V') {
        isWinnerPosition = true;
    }

    // No print do Jefão, 10000 <= 1514 deveria dar False.
    return isWinnerPrice ? 'Você' : 'Outro';
}

const result = calculateGanhador(itemData);
console.log('--- RESULTADO ---');
console.log('Status Calculado:', result);
console.log('Esperado: Outro (Perdendo)');

if (result === 'Outro') {
    console.log('✅ TESTE SUCESSO: A lógica de precoInformado detecta corretamente a derrota.');
} else {
    console.log('❌ TESTE FALHA: O robô ainda acha que está ganhando!');
}
