(function() {
    console.log("%c[POLARYON] Escuta-Geral v3.6.30 Ativado! 🛰️", "color: #00ff00; font-weight: bold;");

    function processSerproData(data, url) {
        // Log de depuração para o usuário ver o que está passando
        console.log(`%c[POLARYON] Interceptado: ${url.split('?')[0]}`, "color: #888; font-size: 10px;");

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

    // 🕵️‍♂️ INTERCEPTOR DE FETCH
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        if (url.includes('serpro.gov.br')) {
            const clone = response.clone();
            clone.json().then(data => processSerproData(data, url)).catch(() => {});
        }
        return response;
    };

    // 🕵️‍♂️ INTERCEPTOR DE XHR
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };

    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            if (this._url && this._url.includes('serpro.gov.br')) {
                try {
                    const data = JSON.parse(this.responseText);
                    processSerproData(data, this._url);
                } catch (e) {}
            }
        });
        return send.apply(this, arguments);
    };
})();
