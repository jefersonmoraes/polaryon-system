const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

class VisualRunner {
    constructor(dashboardWebContents) {
        this.dashboardWebContents = dashboardWebContents;
        this.sessions = new Map();

        // Listener global unificado para atualizações de todas as janelas injetadas
        ipcMain.removeAllListeners('portal-update');
        ipcMain.on('portal-update', (event, data) => {
            if (this.dashboardWebContents) {
                this.dashboardWebContents.send('bidding-update', data);
            }
        });

        // 🛡️ NOVO: Listener Híbrido Injetado (AGORA COM BLACKBOX AUTOMÁTICO v2.3)
        ipcMain.removeAllListeners('portal-hybrid-capture');
        ipcMain.on('portal-hybrid-capture', (event, data) => {
            if (this.dashboardWebContents) {
                this.dashboardWebContents.send('bidding-hybrid-dump', data);
            }

            // GRAVAÇÃO DE DIAGNÓSTICO (BLACKBOX)
            if (data.action === 'API_DUMP' && data.data && data.data.response) {
                this.saveToBlackBox(data.data.url, data.data.response);
            }
        });

        // Listener para Cliques de Elite v3 (SHADOW CLICK - CDP)
        ipcMain.on('portal-native-click', async (event, { sessionId, x, y }) => {
            const session = this.sessions.get(sessionId);
            if (session && session.window) {
                const wc = session.window.webContents;
                const pos = { x: Math.round(x), y: Math.round(y) };
                
                console.log(`[POLARYON-WAR] Executando SHADOW CLICK (CDP) em: X=${pos.x}, Y=${pos.y}`);

                try {
                    // Tenta anexar o debugger se ainda não estiver
                    if (!wc.debugger.isAttached()) {
                        wc.debugger.attach('1.3');
                    }

                    // Sequência nativa de protocolo (mesma do Puppeteer)
                    await wc.debugger.sendCommand('Input.dispatchMouseEvent', {
                        type: 'mouseMoved', x: pos.x, y: pos.y
                    });
                    
                    await new Promise(r => setTimeout(r, 50));
                    
                    await wc.debugger.sendCommand('Input.dispatchMouseEvent', {
                        type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1
                    });
                    
                    await new Promise(r => setTimeout(r, 50));
                    
                    await wc.debugger.sendCommand('Input.dispatchMouseEvent', {
                        type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1
                    });

                } catch (e) {
                    console.error("[POLARYON-WAR] Falha no Shadow Click:", e);
                    // Fallback para o sendInputEvent se o CDP falhar
                    wc.sendInputEvent({ type: 'mouseDown', ...pos, button: 'left', clickCount: 1 });
                    setTimeout(() => {
                        wc.sendInputEvent({ type: 'mouseUp', ...pos, button: 'left', clickCount: 1 });
                    }, 50);
                }
            }
        });

        ipcMain.on('save-battle-almanac', (event, data) => {
            this.saveAlmanac(data);
        });

        this.setupIpc();
    }

    saveAlmanac(data) {
        try {
            const almanacDir = path.join(process.cwd(), 'logs', 'almanaque');
            if (!fs.existsSync(almanacDir)) {
                fs.mkdirSync(almanacDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const uasg = data.config?.uasg || 'unknown';
            const baseFileName = `almanaque_${uasg}_${timestamp}`;
            
            // Salva JSON completo
            fs.writeFileSync(path.join(almanacDir, `${baseFileName}.json`), JSON.stringify(data, null, 2));
            
            // Salva HTML para inspeção visual rápida
            if (data.domSnapshot) {
                fs.writeFileSync(path.join(almanacDir, `${baseFileName}.html`), data.domSnapshot);
            }

            console.log(`🛡️ [ALMANAQUE] Missão de Coleta de Dados Concluída: ${baseFileName}`);
        } catch (e) {
            console.error("[ALMANAQUE] Falha na gravação:", e);
        }
    }

    startVisualSession(sessionId, config) {
        if (this.sessions.has(sessionId)) {
            const existingWin = this.sessions.get(sessionId).window;
            if (existingWin) existingWin.focus();
            return;
        }

        const isLoginFlow = config.modality === 'LOGIN_FLOW';

        const win = new BrowserWindow({
            width: 1280,
            height: 900,
            title: isLoginFlow ? 'Polaryon - Autenticação Compras.gov.br' : `Polaryon - Modo Visual (Pregão/Dispensa ${config.numero}/${config.ano})`,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, 'portal-preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false,
                allowRunningInsecureContent: true,
                backgroundThrottling: false, // 🚀 ESSENCIAL: Mantém o scanner na velocidade máxima em segundo plano
                partition: 'persist:comprasgov' 
            }
        });

        this.sessions.set(sessionId, { window: win, config });

        // --- INTERCEPTADOR DE POPUPS E NAVEGAÇÃO ---
        win.webContents.setWindowOpenHandler(({ url }) => {
            if (url.includes('comprasnet-web') || url.includes('disputa') || url.includes('idp.acesso.gov.br')) {
                console.log('[POLARYON-NAV] Redirecionando fluxo para janela principal:', url);
                win.loadURL(url);
                return { action: 'deny' };
            }
            return { action: 'allow' };
        });

        // 🎯 [TACTICAL v3.1] MONITOR DE TRÁFEGO DE ELITE
        const ses = win.webContents.session;
        ses.webRequest.onCompleted({ urls: ['*://cnetmobile.estaleiro.serpro.gov.br/*'] }, async (details) => {
            if (details.url.includes('/itens') || details.url.includes('/disputa')) {
                if (this.dashboardWebContents) {
                    this.dashboardWebContents.send('bidding-network-traffic', {
                        sessionId,
                        url: details.url,
                        statusCode: details.statusCode,
                        timestamp: Date.now()
                    });
                }
            }
        });

        // DETECÇÃO DE LOGIN COM SUCESSO (SIGA STYLE)
        ipcMain.removeAllListeners('login-success');
        ipcMain.on('login-success', (event, { sessionId, url }) => {
            const session = this.sessions.get(sessionId);
            if (session && session.window) {
                console.log(`[POLARYON] Login bem-sucedido detectado. Ocultando janela para modo de fundo: ${url}`);
                session.window.hide(); // Oculta em vez de fechar para manter o preload rodando
                
                if (this.dashboardWebContents) {
                    this.dashboardWebContents.send('bidding-login-finished', { sessionId, url });
                }
            }
        });

        // Injetor de Scripts Globais (Silenciador e Anti-Lag)
        win.webContents.on('did-start-navigation', () => {
            win.webContents.executeJavaScript(`
                window.alert = () => { console.log("Alert silenciado") };
                window.confirm = () => { return true };
                window.prompt = () => { return null };
            `);
        });

        win.webContents.openDevTools();

        win.on('closed', () => {
            this.sessions.delete(sessionId);
            if (this.dashboardWebContents) {
                this.dashboardWebContents.send('bidding-error', { sessionId, error: 'Terminal Fechado.' });
            }
        });

        win.webContents.on('did-finish-load', () => {
            win.webContents.send('init-session', { sessionId, config });
            
            // Se entrarmos em uma URL de disputa e estivermos em modo login, avisamos o dashboard para "acordar"
            const url = win.webContents.getURL();
            if (url.includes('/disputa') && isLoginFlow && this.dashboardWebContents) {
                 this.dashboardWebContents.send('bidding-detected-room', { sessionId, url });
            }
        });

        const startUrl = isLoginFlow 
            ? 'https://www.comprasnet.gov.br/seguro/loginPortalFornecedor.asp'
            : 'https://www.comprasnet.gov.br/seguro/loginPortalFornecedor.asp'; // Fallback link
        
        console.log(`[VISUAL RUNNER] Iniciando em: ${startUrl} (Modo: ${config.modality})`);
        win.loadURL(startUrl);
    }

    stop(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            if (session.window) session.window.close();
            this.sessions.delete(sessionId);
        }
    }

    updateConfig(sessionId, config) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            if (session.window) {
                // Send IPC to the injected preload script
                session.window.webContents.send('update-config', config);
            }
        }
    }

    // --- NOVOS MÉTODOS PARA PARIDADE SIGA PREGÃO ---
    setupIpc() {
        ipcMain.on('visual-focus', (event, sessionId) => {
            const session = this.sessions.get(sessionId);
            if (session && session.window) {
                if (session.window.isMinimized()) session.window.restore();
                session.window.setAlwaysOnTop(true, 'screen-saver');
                session.window.show();
                session.window.focus();
                session.window.setAlwaysOnTop(false);
            }
        });

        ipcMain.on('visual-navigate', (event, { sessionId, url }) => {
            const session = this.sessions.get(sessionId);
            if (session && session.window) {
                if (url) {
                    session.window.loadURL(url);
                } else {
                    const config = session.config;
                    const uasgStr = (config.uasg || "").toString().padStart(6, '0');
                    const numStr = (config.numero || "").toString().padStart(5, '0');
                    const anoStr = (config.ano || "").toString();
                    const compraCode = `${uasgStr}06${numStr}${anoStr}`;
                    session.window.loadURL(`https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa?compra=${compraCode}`);
                }
            }
        });
    }
    // --- BLACKBOX AUTOMÁTICO PARA DIAGNÓSTICO ---
    saveToBlackBox(url, response) {
        try {
            const logDir = path.join(process.cwd(), 'logs', 'blackbox');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            // Nomeia o arquivo de forma legível
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const urlSlug = url.split('/').pop().split('?')[0] || 'api-dump';
            const fileName = `traffic_${timestamp}_${urlSlug}.json`;
            const filePath = path.join(logDir, fileName);

            const payload = {
                capturedAt: new Date().toISOString(),
                url: url,
                data: response
            };

            fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
            console.log(`🛰️ [BLACKBOX] Tráfego capturado e salvo em: ${fileName}`);

            // Limpeza básica: remove arquivos com mais de 24h
            const files = fs.readdirSync(logDir);
            if (files.length > 100) {
                const oldest = files.sort().slice(0, 10);
                oldest.forEach(f => fs.unlinkSync(path.join(logDir, f)));
            }

        } catch (e) {
            console.error("[BLACKBOX] Erro ao salvar log:", e);
        }
    }
}

module.exports = VisualRunner;
