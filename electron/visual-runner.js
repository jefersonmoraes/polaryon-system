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

        ipcMain.removeAllListeners('portal-error');
        ipcMain.on('portal-error', (event, data) => {
            if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                this.dashboardWebContents.send('bidding-error', data);
            }
        });

        ipcMain.removeAllListeners('portal-hybrid-capture');
        ipcMain.on('portal-hybrid-capture', (event, data) => {
            if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                this.dashboardWebContents.send('bidding-hybrid-dump', data);
            }
        });

        // 🏆 RANKING INTERCEPTADO: Repassa dados de /lances/por-participante capturados pelo portal-preload
        ipcMain.removeAllListeners('portal-ranking-data');
        ipcMain.on('portal-ranking-data', (event, { sessionId, itemId, rankingLances }) => {
            console.log(`[POLARYON RANKING IPC] 📊 Recebido ranking do portal: sessionId=${sessionId} itemId=${itemId} lances=${rankingLances.length}`);
            if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                this.dashboardWebContents.send('bidding-ranking-update', {
                    sessionId,
                    itemId,
                    rankingLances,
                    realPosicao: null // será calculado pelo frontend via buildRankingPorParticipante
                });
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
            const isLoginFlow = config.modality === 'LOGIN_FLOW';
            this.sessions.set(sessionId, { window: activeWin, config, loginFinished: !isLoginFlow });

            // Atualiza o título e envia o sinal de inicialização
            const title = isLoginFlow ? 'Polaryon - Autenticação' : `Polaryon - Modo Visual (${config.numero}/${config.ano})`;
            activeWin.setTitle(title);

            activeWin.webContents.send('init-session', { sessionId, config });

            // Navega diretamente para a sala se UASG e Número forem informados
            if (config.uasg && config.numero && config.uasg !== 'LOGIN') {
                const modCode = config.modality === '05' || config.modality === 'PREGAO' ? '05' : '06';
                const paddedNumero = String(config.numero).replace(/\D/g, '').padStart(5, '0');
                const cleanAno = String(config.ano || new Date().getFullYear()).replace(/\D/g, '').slice(-4);
                const paddedUasg = String(config.uasg).replace(/\D/g, '').padStart(6, '0');
                const purchaseId = `${paddedUasg}${modCode}${paddedNumero}${cleanAno}`;
                
                let targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa?compra=${purchaseId}`;
                
                // Extrai compras-id da URL atual se disponível
                try {
                    const currentUrlStr = activeWin.getURL();
                    const currentUrl = new URL(currentUrlStr);
                    const comprasId = currentUrl.searchParams.get('compras-id');
                    if (comprasId) {
                        targetUrl += `&compras-id=${comprasId}`;
                        console.log(`[VISUAL-RUNNER] 🔑 Reaproveitando compras-id do URL ativo: ${comprasId}`);
                    }
                } catch (e) {
                    console.error("[VISUAL-RUNNER] Erro ao extrair compras-id da URL ativa:", e.message);
                }
                
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
            if (details.url.includes('popup.asp') || details.url.includes('popup/')) {
                console.log(`[POLARYON WINDOW] 🚫 Bloqueando popup desnecessário de aviso: ${details.url}`);
                return { action: 'deny' };
            }
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

        const attachNavigationListeners = (targetWin, isChild = false) => {
            const label = isChild ? 'FILHA' : 'PRINCIPAL';

            const getActiveSession = () => {
                for (const [sid, s] of this.sessions.entries()) {
                    if (s.window === win || s.window === targetWin) {
                        return { sessionId: sid, session: s };
                    }
                }
                return { sessionId: null, session: null };
            };

            const handleLegacyRedirect = (event, url) => {
                const isLegacyPortal = url.includes('main.asp') || 
                                       url.includes('main2.asp') || 
                                       url.includes('indexgov.asp') || 
                                       url.includes('analise_amigavel.asp') || 
                                       url.toLowerCase().includes('acessonaoautorizado') || 
                                       url.includes('popup.asp');
                if (isLegacyPortal) {
                    if (event && typeof event.preventDefault === 'function') {
                        event.preventDefault();
                    }
                    console.log(`[POLARYON WINDOW] [${label}] 🚫 Interceptado legado/erro: ${url}`);
                    
                    const { session } = getActiveSession();
                    const activeWin = targetWin && !targetWin.isDestroyed() ? targetWin : (session ? session.window : null);
                    
                    if (activeWin && !activeWin.isDestroyed()) {
                        const handshakeUrl = 'https://www.comprasnet.gov.br/assinadas/dispensa_eletronica.asp';
                        console.log(`[VISUAL-RUNNER] [${label}] Redirecionando para handshake seguro: ${handshakeUrl}`);
                        activeWin.loadURL(handshakeUrl);
                    }
                }
            };

            targetWin.webContents.on('will-navigate', (event, url) => {
                if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                    this.dashboardWebContents.send('bidding-update-log', `[VISUAL] [${label}] will-navigate: ${url}`);
                }
                handleLegacyRedirect(event, url);
            });

            targetWin.webContents.on('will-redirect', (event, url) => {
                if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                    this.dashboardWebContents.send('bidding-update-log', `[VISUAL] [${label}] will-redirect: ${url}`);
                }
                handleLegacyRedirect(event, url);
            });

            targetWin.webContents.on('did-navigate', (event, url) => {
                const { sessionId: currentSessionId, session } = getActiveSession();
                if (!currentSessionId) return;

                if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                    this.dashboardWebContents.send('bidding-update-log', `[VISUAL] [${label}] did-navigate: ${url}`);
                }

                handleLegacyRedirect(null, url);

                if (isChild) {
                    // Se for janela filha (popup de handshake)
                    if (url.includes('/seguro/fornecedor/')) {
                        if (session && session.window && !session.window.isDestroyed()) {
                            console.log(`[VISUAL-RUNNER] [${label}] Popup de handshake detectado. Transferindo para janela principal: ${url}`);
                            
                            // Calcula URL da disputa específica mantendo o compras-id crucial
                            let targetUrl = url;
                            try {
                                const parsedUrl = new URL(url);
                                const comprasId = parsedUrl.searchParams.get('compras-id');
                                if (comprasId && !url.includes('compra=') && session.config && session.config.uasg && session.config.numero && session.config.uasg !== 'LOGIN') {
                                    const modCode = session.config.modality === '05' || session.config.modality === 'PREGAO' ? '05' : '06';
                                    const paddedNumero = String(session.config.numero).replace(/\D/g, '').padStart(5, '0');
                                    const cleanAno = String(session.config.ano || new Date().getFullYear()).replace(/\D/g, '').slice(-4);
                                    const purchaseId = `${session.config.uasg}${modCode}${paddedNumero}${cleanAno}`;
                                    targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa?compra=${purchaseId}&compras-id=${comprasId}`;
                                }
                            } catch (e) {
                                console.error("Erro ao analisar URL do popup de handshake:", e);
                            }

                            // Carrega na janela principal e fecha o popup de forma extremamente suave
                            session.window.loadURL(targetUrl);
                            
                            setTimeout(() => {
                                try {
                                    if (!targetWin.isDestroyed()) {
                                        targetWin.destroy();
                                    }
                                } catch (err) {
                                    console.error("Erro ao fechar popup:", err);
                                }
                            }, 300);
                        }
                    }
                } else {
                    // Se for janela principal
                    const isLegacyLanding = url.includes('main.asp') || url.includes('index.html');
                    if (isLegacyLanding) {
                        if (session && session.window && !session.window.isDestroyed() && !session.loginFinished) {
                            session.loginFinished = true; // Evita loop
                            if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                                this.dashboardWebContents.send('bidding-update-log', `[VISUAL] LOGIN CONCLUÍDO! Iniciando handshake seguro (dispensa_eletronica.asp)...`);
                            }
                            if (!session.window.webContents.isDevToolsOpened()) {
                                session.window.webContents.openDevTools({ mode: 'detach' });
                            }
                            const handshakeUrl = 'https://www.comprasnet.gov.br/assinadas/dispensa_eletronica.asp';
                            console.log(`[VISUAL-RUNNER] [${label}] 🚀 Direcionando para handshake seguro: ${handshakeUrl}`);
                            session.window.loadURL(handshakeUrl);
                        }
                    } else if (url.includes('/seguro/fornecedor/')) {
                        if (session && session.window && !session.window.isDestroyed()) {
                            if (!url.includes('compra=') && session.config && session.config.uasg && session.config.numero && session.config.uasg !== 'LOGIN') {
                                const modCode = session.config.modality === '05' || session.config.modality === 'PREGAO' ? '05' : '06';
                                const paddedNumero = String(session.config.numero).replace(/\D/g, '').padStart(5, '0');
                                const cleanAno = String(session.config.ano || new Date().getFullYear()).replace(/\D/g, '').slice(-4);
                                const purchaseId = `${session.config.uasg}${modCode}${paddedNumero}${cleanAno}`;
                                
                                // Extrai o compras-id da URL atual (se existir) para persistir o token seguro de lances
                                let targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa?compra=${purchaseId}`;
                                try {
                                    const parsedUrl = new URL(url);
                                    const comprasId = parsedUrl.searchParams.get('compras-id');
                                    if (comprasId) {
                                        targetUrl += `&compras-id=${comprasId}`;
                                    }
                                } catch (e) {}

                                console.log(`[VISUAL-RUNNER] [${label}] 🎯 Redirecionando para a disputa específica com token: ${targetUrl}`);
                                session.window.loadURL(targetUrl);
                            } else {
                                if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                                    this.dashboardWebContents.send('bidding-login-finished', { sessionId: currentSessionId, url });
                                }
                            }
                        }
                    }
                }
            });

            targetWin.webContents.on('did-start-navigation', (event, url) => {
                targetWin.webContents.executeJavaScript(`
                    window.alert = () => { console.log("Alert silenciado") };
                    window.confirm = () => { return true };
                    window.prompt = () => { return null };
                `);

                if (url) {
                    handleLegacyRedirect(null, url);
                }
            });
        };

        // Ativa os listeners na janela principal
        attachNavigationListeners(win, false);

        // Atualiza did-create-window para ativar os listeners nas janelas filhas
        win.webContents.on('did-create-window', (childWindow) => {
            console.log("[POLARYON WINDOW] Janela filha criada com sucesso!");
            childWindow.webContents.setUserAgent(win.webContents.getUserAgent());
            childWindow.webContents.openDevTools({ mode: 'detach' });
            logConsole(childWindow, 'FILHA');
            attachNavigationListeners(childWindow, true); // 🔥 PROTEGE A JANELA FILHA CONTRA LOOPS E ERROS DE LOGIN!
        });

        win.webContents.openDevTools({ mode: 'detach' });

        win.on('closed', () => {
            this.sessions.delete(sessionId);
        });

        win.webContents.on('did-finish-load', () => {
            if (!win.isDestroyed()) win.webContents.send('init-session', { sessionId, config });
        });

        const startUrl = 'https://sso.acesso.gov.br/authorize?response_type=code&client_id=comprasnet.gov.br&scope=openid+profile+email+phone+govbr_confiabilidades&state=F&redirect_uri=https://www.comprasnet.gov.br/seguro/landing_sso.asp';
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
            if (global.biddingRunner) {
                global.biddingRunner.focusedSessionId = sessionId;
                console.log(`[POLARYON] 👁️ Foco da sessão alterado para ${sessionId}. Acelerando radar correspondente!`);
            }
        });
        ipcMain.on('visual-navigate', (event, { sessionId, url }) => {
            const session = this.sessions.get(sessionId);
            if (session && session.window && !session.window.isDestroyed()) {
                if (url) session.window.loadURL(url);
            }
        });

        // 🔄 AUTO-RENEW: Disparado pelo bidding-runner quando o token expira (401)
        ipcMain.on('request-token-renewal', (event, { sessionId }) => {
            console.log(`[VISUAL RUNNER] 🔑 Renovação de token solicitada para sessão ${sessionId}. Recarregando autenticação...`);
            
            // Estratégia 1: Se já temos um token válido, reinjeta nas janelas abertas
            if (global.serproToken) {
                for (const [sId, session] of this.sessions) {
                    if (session.window && !session.window.isDestroyed()) {
                        session.window.webContents.send('force-token-injection', { token: global.serproToken });
                    }
                }
                console.log(`[VISUAL RUNNER] ✅ Token reaproveitado e reforçado em todas as janelas abertas.`);
                return;
            }

            // Estratégia 2: Sem token, recarrega a janela de sessão para capturar um novo
            const session = this.sessions.get(sessionId);
            if (session && session.window && !session.window.isDestroyed()) {
                const currentUrl = session.window.webContents.getURL();
                // Só recarrega se não estiver já na tela de login
                if (!currentUrl.includes('login') && !currentUrl.includes('acesso.gov.br')) {
                    console.log(`[VISUAL RUNNER] 🔄 Recarregando janela da sessão ${sessionId} para capturar novo token...`);
                    session.window.webContents.reload();
                }
            }
        });
    }
}

module.exports = VisualRunner;
