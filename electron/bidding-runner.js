const axios = require('axios');
const https = require('https');

/**
 * BiddingRunner - Motor de Lances Local (Rodando no PC do Usuário)
 * Esta classe emula o comportamento do BiddingListener do servidor, 
 * mas roda dentro do processo principal do Electron.
 */
class BiddingRunner {
    constructor(webContents) {
        this.webContents = webContents;
        this.activeSessions = new Map(); // sessionId -> { intervalId, config, vault }
    }

    /**
     * Inicia o monitoramento de uma sala de disputa
     */
    async start(sessionId, uasg, numero, ano, vault) {
        if (this.activeSessions.has(sessionId)) return;

        console.log(`[LOCAL_RUNNER] Iniciando monitoramento para ${uasg}/${numero}-${ano}`);

        const agent = new https.Agent({
            pfx: Buffer.from(vault.pfxBase64, 'base64'),
            passphrase: vault.password,
            rejectUnauthorized: false
        });

        const paddedNum = String(numero).padStart(5, '0');
        const idCompra = `${uasg}06${paddedNum}${ano}`;

        const intervalId = setInterval(async () => {
            try {
                // 1. Busca Itens (Modo Público)
                const publicApiUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${idCompra}/itens`;
                const response = await axios.get(publicApiUrl, { 
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0 Polaryon-Desktop/1.0' }
                });

                if (response.data && Array.isArray(response.data)) {
                    const items = response.data.map(item => ({
                        itemId: String(item.numeroItem || item.sequencial),
                        valorAtual: item.melhorLance || item.valorEstimado || 0,
                        ganhador: item.fase === 'DISPUTA' ? 'Em Disputa' : (item.melhorLance ? 'Concorrente' : 'Aguardando'),
                        status: item.situacao || item.fase || 'Aberto',
                        descricao: item.descricao,
                    }));

                    // 2. Enviar atualização para o Frontend (React)
                    this.webContents.send('bidding-update', {
                        sessionId,
                        items,
                        timestamp: new Date().toISOString(),
                        source: 'LOCAL'
                    });
                }
            } catch (error) {
                console.error(`[LOCAL_RUNNER] Erro no polling: ${error.message}`);
                this.webContents.send('bidding-error', { sessionId, error: error.message });
            }
        }, 3000);

        this.activeSessions.set(sessionId, { intervalId, uasg, numero, vault });
    }

    /**
     * Para o monitoramento
     */
    stop(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            clearInterval(session.intervalId);
            this.activeSessions.delete(sessionId);
            console.log(`[LOCAL_RUNNER] Monitoramento parado para ${sessionId}`);
        }
    }

    async executeBid(sessionId, itemId, value) {
        const session = this.activeSessions.get(sessionId);
        if (!session) throw new Error('Sessão local não encontrada.');

        console.log(`[LOCAL_RUNNER] EXECUTANDO LANCE REAL: Item ${itemId} -> R$ ${value}`);
        
        // Aqui viria a lógica de POST para v1/lances usando o 'agent' mTLS
        // Por enquanto, emitimos um log de sucesso para o frontend
        return { success: true, value };
    }
}

module.exports = BiddingRunner;
