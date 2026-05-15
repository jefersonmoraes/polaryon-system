(function() {
    console.log("%c[POLARYON] Escuta-Geral v3.6.29 Ativado! 🛰️", "color: #00ff00; font-weight: bold;");

    // 🕵️‍♂️ INTERCEPTOR DE FETCH (Moderno)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const url = args[0];
        if (typeof url === 'string' && (url.includes('em-disputa') || url.includes('itens'))) {
            const clone = response.clone();
            clone.json().then(data => processSerproData(data, url)).catch(() => {});
        }
        return response;
    };

    // 🕵️‍♂️ INTERCEPTOR DE XHR (Tradicional - Usado pelo Comprasnet antigo)
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };

    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            if (this._url && (this._url.includes('em-disputa') || this._url.includes('itens'))) {
                try {
                    const data = JSON.parse(this.responseText);
                    processSerproData(data, this._url);
                } catch (e) {}
            }
        });
        return send.apply(this, arguments);
    };

    function processSerproData(data, url) {
        const items = Array.isArray(data) ? data : (data.itens || []);
        const match = url.match(/\/compras\/(\d+)\//);
        const roomCode = match ? match[1] : null;

        if (items.length > 0 && roomCode) {
            if (window.electronAPI && window.electronAPI.sendPortalData) {
                window.electronAPI.sendPortalData({
                    type: 'portal-sync',
                    roomCode: roomCode,
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
            console.log(`%c[POLARYON] Sincronia detectada na sala ${roomCode}! 📡`, "color: #00d4ff; font-weight: bold;");
        }
    }
})();
