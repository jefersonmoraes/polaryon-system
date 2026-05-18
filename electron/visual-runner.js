const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

class VisualRunner {
    constructor(dashboardWebContents) {
        this.dashboardWebContents = dashboardWebContents;
        this.sessions = new Map();

        ipcMain.removeAllListeners('portal-update');
        ipcMain.on('portal-update', (event, data) => {
            if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                this.dashboardWebContents.send('bidding-update', data);
            }
        });

        ipcMain.removeAllListeners('portal-hybrid-capture');
        ipcMain.on('portal-hybrid-capture', (event, data) => {
            if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                this.dashboardWebContents.send('bidding-hybrid-dump', data);
            }
        });

        ipcMain.on('portal-native-click', async (event, { sessionId, x, y }) => {
            const session = this.sessions.get(sessionId);
            if (session && session.window && !session.window.isDestroyed()) {
                const wc = session.window.webContents;
                const pos = { x: Math.round(x), y: Math.round(y) };
                try {
                    if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
                    await wc.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y });
                    await new Promise(r => setTimeout(r, 50));
                    await wc.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
                    await new Promise(r => setTimeout(r, 50));
                    await wc.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
                } catch (e) {
                    wc.sendInputEvent({ type: 'mouseDown', ...pos, button: 'left', clickCount: 1 });
                    setTimeout(() => wc.sendInputEvent({ type: 'mouseUp', ...pos, button: 'left', clickCount: 1 }), 50);
                }
            }
        });

        this.setupIpc();
    }

    startVisualSession(sessionId, config) {
        if (this.sessions.has(sessionId)) {
            const existingWin = this.sessions.get(sessionId).window;
            if (existingWin) existingWin.focus();
            return;
        }

        // 🛰️ [REUTILIZAÇÃO DE JANELA] Se já houver alguma janela ativa aberta (ex: fluxo de login), reutiliza-a
        // para evitar login duplo ou múltiplas janelas no mesmo processo (v3.6.47)
        let activeSessionId = null;
        let activeWin = null;
        
        for (const [id, sess] of this.sessions.entries()) {
            if (sess.window && !sess.window.isDestroyed()) {
                activeSessionId = id;
                activeWin = sess.window;
                break;
            }
        }

        if (activeWin) {
            console.log(`[VISUAL-RUNNER] 🔄 Reutilizando janela ativa (${activeSessionId}) para a nova sessão: ${sessionId}`);
            
            // Remove a sessão antiga do map e registra a nova com a mesma janela
            this.sessions.delete(activeSessionId);
            this.sessions.set(sessionId, { window: activeWin, config, loginFinished: true });

            // Atualiza o título e envia o sinal de inicialização
            const isLoginFlow = config.modality === 'LOGIN_FLOW';
            const title = isLoginFlow ? 'Polaryon - Autenticação' : `Polaryon - Modo Visual (${config.numero}/${config.ano})`;
            activeWin.setTitle(title);

            activeWin.webContents.send('init-session', { sessionId, config });

            // Navega diretamente para a sala se UASG e Número forem informados
            if (config.uasg && config.numero && config.uasg !== 'LOGIN') {
                const modCode = config.modality === '05' || config.modality === 'PREGAO' ? '05' : '06';
                const paddedNumero = String(config.numero).replace(/\D/g, '').padStart(5, '0');
                const cleanAno = String(config.ano || new Date().getFullYear()).replace(/\D/g, '').slice(-4);
                const purchaseId = `${config.uasg}${modCode}${paddedNumero}${cleanAno}`;
                const targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa?compra=${purchaseId}`;
                
                console.log(`[VISUAL-RUNNER] 🚀 Reutilização: Navegando para a disputa direta: ${targetUrl}`);
                activeWin.loadURL(targetUrl);
            }
            return;
        }

        const isLoginFlow = config.modality === 'LOGIN_FLOW';
 
        // 🛰️ [TELEMETRIA DE CONSOLE] Inicializa arquivo de log local para diagnóstico remoto (v3.6.56)
        const fs = require('fs');
        const path = require('path');
        const logFilePath = path.join('e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system', 'visual_console_logs.txt');
        try {
            fs.writeFileSync(logFilePath, `=== POLARYON VISUAL CONSOLE LOGS - INICIADO EM ${new Date().toLocaleString()} ===\n`, 'utf8');
        } catch (e) {}
 
        const logConsole = (targetWin, type) => {
            targetWin.webContents.on('console-message', (event, level, message, line, sourceId) => {
                const levels = ['INFO', 'WARNING', 'ERROR'];
                const lvl = levels[level] || 'LOG';
                const timestamp = new Date().toLocaleTimeString();
                const logLine = `[${timestamp}] [${type}] [${lvl}] ${message} (Script: ${sourceId}:${line})`;
                try {
                    fs.appendFileSync(logFilePath, logLine + '\n', 'utf8');
                } catch (err) {}
            });
        };
 
        const win = new BrowserWindow({
            width: 1280,
            height: 900,
            title: isLoginFlow ? 'Polaryon - Autenticação' : `Polaryon - Modo Visual (${config.numero}/${config.ano})`,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, 'portal-preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                nodeIntegrationInSubFrames: false, // 🛰️ [SUBFRAMES/IFRAMES] Previne injeção de globals do Node no contexto global de subframes, evitando conflitos de jQuery/CommonJS (v3.6.54)
                webSecurity: false,
                allowRunningInsecureContent: true,
                backgroundThrottling: false, 
                partition: 'persist:polaryon-global' 
            },
            show: true
        });
 
        logConsole(win, 'PRINCIPAL');
 
        const modernUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
        win.webContents.setUserAgent(modernUserAgent);
 
        // 🛰️ [SIFÃO MULTI-JANELAS] Garante que janelas filhas (popups do Comprasnet/Dispensa) herdem o preload, cookies e DevTools (v3.6.45)
        win.webContents.setWindowOpenHandler((details) => {
            console.log(`[POLARYON WINDOW] Nova janela filha solicitada: ${details.url}`);
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    autoHideMenuBar: true,
                    webPreferences: {
                        preload: path.join(__dirname, 'portal-preload.js'),
                        nodeIntegration: false,
                        contextIsolation: true,
                        nodeIntegrationInSubFrames: false, // 🛰️ Multi-Janelas e Popups herdam prevenção de conflitos CommonJS
                        webSecurity: false,
                        allowRunningInsecureContent: true,
                        backgroundThrottling: false,
                        partition: 'persist:polaryon-global'
                    }
                }
            };
        });
 
        win.webContents.on('did-create-window', (childWindow) => {
            console.log("[POLARYON WINDOW] Janela filha criada com sucesso!");
            childWindow.webContents.setUserAgent(win.webContents.getUserAgent());
            childWindow.webContents.openDevTools({ mode: 'detach' });
            logConsole(childWindow, 'FILHA');
        });
 
        this.sessions.set(sessionId, { window: win, config });

        const ses = win.webContents.session;

        // 🎯 [SIFÃO TOTAL v4.1] Captura Token E Aprende Salas via Tráfego
        ses.webRequest.onBeforeSendHeaders({ urls: ['*://cnetmobile.estaleiro.serpro.gov.br/*'] }, (details, callback) => {
            const auth = details.requestHeaders['Authorization'] || details.requestHeaders['authorization'];
            
            // 🕵️ ESPIONAGEM DE ESTRUTURA (v3.5.55)
            if (details.method === 'POST' && details.url.includes('/lances')) {
                console.log(`[POLARYON SPY] Estrutura detectada em: ${details.url}`);
                if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                    this.dashboardWebContents.send('bidding-update-log', `🔍 Espião: Capturando estrutura de lance oficial...`);
                }
            }

            if (auth && auth.toLowerCase().startsWith('bearer')) {
                global.serproToken = auth.replace(/^bearer/i, 'Bearer'); // 🔥 SALVA GLOBALMENTE E NORMALIZADO PARA O MOTOR BACKGROUND (v3.6.47)
                if (!global.ipcTokenRegistered) {
                    global.ipcTokenRegistered = true;
                    ipcMain.handle('get-login-token', () => global.serproToken);
                }
                
                if (!win.isDestroyed()) {
                    // Injeta Token
                    win.webContents.send('force-token-injection', { token: global.serproToken });
                    
                    // Aprende Sala (Extrai ID da URL se houver)
                    const idMatch = details.url.match(/\/v1\/compras\/(\d+)/);
                    if (idMatch) {
                        const pId = idMatch[1];
                        win.webContents.send('force-room-learning', { purchaseId: pId });
                    }

                    // 🔥 DESBLOQUEIO GARANTIDO POR TOKEN (v3.6.50): Se capturamos o token legítimo, o usuário já está autenticado!
                    const session = this.sessions.get(sessionId);
                    if (session && !session.loginFinished) {
                        session.loginFinished = true;
                        if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                            this.dashboardWebContents.send('bidding-update-log', `[VISUAL] Token de combate interceptado! Desbloqueando dashboard...`);
                            this.dashboardWebContents.send('bidding-login-finished', { sessionId, url: details.url });
                        }
                    }
                }
            }
            callback({ requestHeaders: details.requestHeaders });
        });

        ses.webRequest.onCompleted({ urls: ['*://cnetmobile.estaleiro.serpro.gov.br/*'] }, async (details) => {
            if (details.url.includes('/itens') || details.url.includes('/disputa')) {
                if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                    this.dashboardWebContents.send('bidding-network-traffic', { sessionId, url: details.url, statusCode: details.statusCode, timestamp: Date.now() });
                }
            }
        });

        win.webContents.on('will-navigate', (event, url) => {
            if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                this.dashboardWebContents.send('bidding-update-log', `[VISUAL] will-navigate: ${url}`);
            }
        });

        win.webContents.on('did-navigate', (event, url) => {
            if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                this.dashboardWebContents.send('bidding-update-log', `[VISUAL] did-navigate: ${url}`);
            }

            const isLoginFinished = url.includes('intro.htm') || url.includes('index.html') || url.includes('/seguro/fornecedor/');
            
            if (isLoginFinished) {
                const session = this.sessions.get(sessionId);
                if (session && session.window && !session.window.isDestroyed() && !session.loginFinished) {
                    session.loginFinished = true; // Evita loop
                    if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                        this.dashboardWebContents.send('bidding-update-log', `[VISUAL] LOGIN CONCLUÍDO COM SUCESSO! Redirecionando para a disputa...`);
                    }
                    if (!session.window.webContents.isDevToolsOpened()) {
                        session.window.webContents.openDevTools({ mode: 'detach' });
                    }
                    
                    if (session.config && session.config.uasg && session.config.numero && session.config.uasg !== 'LOGIN') {
                        const modCode = session.config.modality === '05' || session.config.modality === 'PREGAO' ? '05' : '06';
                        const paddedNumero = String(session.config.numero).replace(/\D/g, '').padStart(5, '0');
                        const cleanAno = String(session.config.ano || new Date().getFullYear()).replace(/\D/g, '').slice(-4);
                        const purchaseId = `${session.config.uasg}${modCode}${paddedNumero}${cleanAno}`;
                        const targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa?compra=${purchaseId}`;
                        
                        console.log(`[VISUAL-RUNNER] 🚀 Login Concluído: Direcionando para a disputa direta: ${targetUrl}`);
                        session.window.loadURL(targetUrl);
                    } else {
                        session.window.loadURL('https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa');
                    }
                    if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                        this.dashboardWebContents.send('bidding-login-finished', { sessionId, url });
                    }
                }
            }
        });

        win.webContents.on('did-start-navigation', () => {
            win.webContents.executeJavaScript(`
                window.alert = () => { console.log("Alert silenciado") };
                window.confirm = () => { return true };
                window.prompt = () => { return null };
            `);
        });

        win.webContents.openDevTools({ mode: 'detach' });

        win.on('closed', () => {
            this.sessions.delete(sessionId);
        });

        win.webContents.on('did-finish-load', () => {
            if (!win.isDestroyed()) win.webContents.send('init-session', { sessionId, config });
        });

        const startUrl = 'https://www.gov.br/compras/pt-br/@@configuracoes_view';
        win.loadURL(startUrl);
    }

    sendManualBid({ purchaseId, itemId, bidId, value }) {
        this.sessions.forEach(session => {
            if (session.window && !session.window.isDestroyed()) {
                session.window.webContents.send('manual-bid', { purchaseId, itemId, bidId, value });
            }
        });
    }

    stop(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            if (session.window && !session.window.isDestroyed()) session.window.close();
            this.sessions.delete(sessionId);
        }
    }

    updateConfig(sessionId, config) {
        const session = this.sessions.get(sessionId);
        if (session && session.window && !session.window.isDestroyed()) {
            session.config = { ...session.config, ...config };
            session.window.webContents.send('update-config', config);
            console.log(`[VISUAL-RUNNER] Configuração Atualizada para ${sessionId}:`, config);
        }
    }

    setupIpc() {
        ipcMain.on('visual-focus', (event, sessionId) => {
            const session = this.sessions.get(sessionId);
            if (session && session.window && !session.window.isDestroyed()) {
                if (session.window.isMinimized()) session.window.restore();
                session.window.show();
                session.window.focus();
            }
        });
        ipcMain.on('visual-navigate', (event, { sessionId, url }) => {
            const session = this.sessions.get(sessionId);
            if (session && session.window && !session.window.isDestroyed()) {
                if (url) session.window.loadURL(url);
            }
        });
    }
}

module.exports = VisualRunner;
