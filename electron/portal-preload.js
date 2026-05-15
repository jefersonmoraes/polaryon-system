(function() {
    console.log("%c[POLARYON] Interceptor de Elite v3.6.27 Iniciado!", "color: #00ff00; font-weight: bold;");

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const url = args[0];

        if (typeof url === 'string' && (url.includes('em-disputa') || url.includes('itens'))) {
            // Extrai o código da compra da URL (ex: 29000206002052026)
            const match = url.match(/\/compras\/(\d+)\//);
            const roomCode = match ? match[1] : null;

            const clone = response.clone();
            clone.json().then(data => {
                const items = Array.isArray(data) ? data : (data.itens || []);
                if (items.length > 0 && roomCode) {
                    if (window.electronAPI && window.electronAPI.sendPortalData) {
                        window.electronAPI.sendPortalData({
                            type: 'portal-sync',
                            roomCode: roomCode, // Carimbo da Sala
                            timestamp: Date.now(),
                            items: items.map(it => ({
                                itemId: String(it.numero || it.identificador),
                                valorAtual: it.melhorValorGeral ? it.melhorValorGeral.valorCalculado : it.melhorLance,
                                meuValor: it.melhorValorFornecedor ? it.melhorValorFornecedor.valorCalculado : it.valorLanceProposta,
                                status: it.faseTraduzido || it.fase,
                                posicao: it.situacaoParticipanteDisputaTraduzido || (it.situacaoParticipanteDisputa === 'G' ? 'GANHANDO' : 'PERDENDO'),
                                timerSeconds: it.segundosParaEncerramento || -1,
                                dataHoraFimContagem: it.dataHoraFimContagem,
                                desc: it.descricao
                            }))
                        });
                    }
                    console.log(`%c[POLARYON] Dados da sala ${roomCode} enviados para o Dashboard!`, "color: #00d4ff;");
                }
            }).catch(() => {});
        }
        return response;
    };
})();
