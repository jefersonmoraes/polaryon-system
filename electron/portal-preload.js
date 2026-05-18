(function() {
    const { ipcRenderer } = require('electron');

    // 🛡️ PREVINE CONFLITO DE JQUERY COM NODE/COMMONJS (CLASSIC ELECTRON BUG - v3.6.54)
    if (typeof window !== 'undefined') {
        delete window.module;
        delete window.exports;
        delete window.require;
    }

    ipcRenderer.invoke('get-app-version').then(v => {
        console.log(`%c[POLARYON] Escuta-Geral v${v} Ativado! 🛰️`, "color: #00ff00; font-weight: bold;");
    }).catch(() => {
        console.log("%c[POLARYON] Escuta-Geral Ativado! 🛰️", "color: #00ff00; font-weight: bold;");
    });

    let sessionToken = '';
    const synchronizedPurchases = new Set();

    // 🛡️ Recebe e armazena o token de sessão capturado pelo Visual Runner
    ipcRenderer.on('force-token-injection', (event, data) => {
        if (data && data.token) {
            sessionToken = data.token;
            console.log("%c[POLARYON] Token de Combate Armado e Pronto!", "color: #ff00ff; font-size: 11px;");
        }
    });

    // 🎯 O GATILHO KAMIKAZE: Envia o lance utilizando o Bypass de Captcha do Siga
    ipcRenderer.on('manual-bid', async (event, { purchaseId, itemId, value }) => {
        console.log(`%c[POLARYON TÁTICO] Iniciando Sequência de Disparo - Item: ${itemId} | Valor: R$ ${value}`, "color: #ffaa00; font-weight: bold;");
        
        if (!sessionToken) {
            console.error('[POLARYON] ERRO: Token de Sessão ausente. O robô não interceptou o login ainda.');
            return;
        }

        try {
            // 1. Extração Sombria dos Captchas (Farmados da Nuvem do Siga)
            const capHeaders = { 
                'origin': 'https://disputas.sigapregao.com.br',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SIGAClient/0.7.2'
            };
            
            const [c1, c2] = await Promise.all([
                fetch('https://capgen.sigapregao.com.br/capgen/captcha-dispensas', { headers: capHeaders }).then(r => r.text()).catch(() => ''),
                fetch('https://capgen.sigapregao.com.br/capgen/captcha-dispensas-2', { headers: capHeaders }).then(r => r.text()).catch(() => '')
            ]);

            // 2. Monta a URL de Ataque do Serpro
            const targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemId}/lances?captcha1=${c1}&captcha2=${c2}&captcha3=${c1}`;

            // 3. Payload do Protocolo Oficial
            const payload = {
                valorInformado: parseFloat(value),
                faseItem: "LA"
            };

            // 4. Disparo Furtivo
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Authorization': sessionToken,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`%c[POLARYON] LANCE DE R$ ${value} ENVIADO COM SUCESSO! 🎯🎯🎯`, "color: #10b981; font-weight: bold; font-size: 16px;");
            } else {
                const errText = await response.text();
                console.error(`%c[POLARYON] LANCE REJEITADO (Status ${response.status}): ${errText}`, "color: #ef4444; font-weight: bold;");
            }
        } catch (e) {
            console.error('[POLARYON] Exceção crítica durante o disparo:', e);
        }
    });

    // -------------------------------------------------------------------------
    // SISTEMA DE INTERCEPTAÇÃO DE REDE (O "ESCUTA-GERAL")
    // -------------------------------------------------------------------------
    function processSerproData(data, url) {
        console.log(`%c[POLARYON] Radar: ${url.split('?')[0]}`, "color: #888; font-size: 10px;");

        // Se detectarmos uma lista contendo IDs de compra, começamos a sincronização delas
        const jsonStr = JSON.stringify(data || {});
        const discoveredIds = jsonStr.match(/\b\d{17}\b/g);
        if (discoveredIds && discoveredIds.length > 0) {
            discoveredIds.forEach(purchaseId => {
                if (!synchronizedPurchases.has(purchaseId)) {
                    synchronizedPurchases.add(purchaseId);
                    console.log(`%c[POLARYON DETECTOR] Nova sala detectada por varredura: ${purchaseId}`, "color: #10b981; font-weight: bold;");
                    autoFetchPurchaseItems(purchaseId);
                }
            });
        }

        const items = Array.isArray(data) ? data : (data.itens || []);
        const match = url.match(/\/compras\/(\d+)\//);
        const roomCode = match ? match[1] : null;

        if (items.length > 0 && roomCode) {
            // Se as configs originais do robô existirem, manda para a tela
            if (typeof ipcRenderer !== 'undefined') {
                ipcRenderer.send('send-portal-data', {
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
        }
    }

    async function autoFetchPurchaseItems(purchaseId) {
        if (!sessionToken) return;
        try {
            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/em-disputa`;
            const res = await originalFetch(url, {
                headers: {
                    'Authorization': sessionToken,
                    'Accept': 'application/json'
                }
            });
            if (res.ok) {
                const data = await res.json();
                processSerproData(data, url);
            }
        } catch (e) {
            console.error(`[POLARYON] Erro ao sincronizar itens da sala ${purchaseId}:`, e);
        }
    }

    // 🕵️‍♂️ INTERCEPTOR DE FETCH
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        // Captura o token do cabeçalho se existir
        if (args[1] && args[1].headers) {
            const headers = args[1].headers;
            let auth = '';
            if (headers instanceof Headers) {
                auth = headers.get('Authorization') || headers.get('authorization');
            } else if (typeof headers === 'object') {
                auth = headers['Authorization'] || headers['authorization'] || headers['Authorization '] || headers['authorization '];
            }
            if (auth && auth.toLowerCase().startsWith('bearer')) {
                sessionToken = auth;
            }
        }

        const response = await originalFetch(...args);
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        const isSerpro = url.includes('serpro.gov.br') || url.includes('/comprasnet-') || url.includes('/compras/') || window.location.hostname.includes('serpro.gov.br');
        if (isSerpro) {
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

    const setRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        if (header.toLowerCase() === 'authorization' && value && value.toLowerCase().startsWith('bearer')) {
            sessionToken = value;
            console.log("%c[POLARYON XHR] Token Armado via XHR: " + value.substring(0, 30) + "...", "color: #00ffff; font-weight: bold;");
        }
        return setRequestHeader.apply(this, arguments);
    };

    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            const isSerpro = this._url && (this._url.includes('serpro.gov.br') || this._url.includes('/comprasnet-') || this._url.includes('/compras/') || window.location.hostname.includes('serpro.gov.br'));
            if (isSerpro) {
                try {
                    const data = JSON.parse(this.responseText);
                    processSerproData(data, this._url);
                } catch (e) {}
            }
        });
        return send.apply(this, arguments);
    };

    // LOOP DE FUNDO DE AUTO-SINCRONIZAÇÃO EM TEMPO REAL (8 SEGUNDOS)
    setInterval(async () => {
        if (!sessionToken || synchronizedPurchases.size === 0) return;
        for (const purchaseId of synchronizedPurchases) {
            try {
                const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/em-disputa`;
                const res = await originalFetch(url, {
                    headers: {
                        'Authorization': sessionToken,
                        'Accept': 'application/json'
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    processSerproData(data, url);
                }
            } catch (e) {
                console.error(`[POLARYON LOOP] Falha ao atualizar sala ${purchaseId}:`, e);
            }
        }
    }, 8000);
})();
