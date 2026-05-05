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

        const isLoginFlow = config.modality === 'LOGIN_FLOW';

        const win = new BrowserWindow({
            width: 1280,
            height: 900,
            title: isLoginFlow ? 'Polaryon - Autenticação' : `Polaryon - Modo Visual (${config.numero}/${config.ano})`,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, 'portal-preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false,
                allowRunningInsecureContent: true,
                backgroundThrottling: false, 
                partition: 'persist:polaryon-global' 
            },
            show: true
        });

        const modernUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
        win.webContents.setUserAgent(modernUserAgent);

        this.sessions.set(sessionId, { window: win, config });

        const ses = win.webContents.session;

        // 🎯 [SIFÃO TOTAL v4.1] Captura Token E Aprende Salas via Tráfego
        ses.webRequest.onBeforeSendHeaders({ urls: ['*://cnetmobile.estaleiro.serpro.gov.br/*'] }, (details, callback) => {
            const auth = details.requestHeaders['Authorization'] || details.requestHeaders['authorization'];
            if (auth && auth.startsWith('Bearer')) {
                if (!win.isDestroyed()) {
                    // Injeta Token
                    win.webContents.send('force-token-injection', { token: auth });
                    
                    // Aprende Sala (Extrai ID da URL se houver)
                    const idMatch = details.url.match(/\/v1\/compras\/(\d+)/);
                    if (idMatch) {
                        const pId = idMatch[1];
                        win.webContents.send('force-room-learning', { purchaseId: pId });
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

        ipcMain.removeAllListeners('login-success');
        ipcMain.on('login-success', (event, { sessionId, url }) => {
            const session = this.sessions.get(sessionId);
            if (session && session.window && !session.window.isDestroyed()) {
                session.window.hide(); 
                if (this.dashboardWebContents && !this.dashboardWebContents.isDestroyed()) {
                    this.dashboardWebContents.send('bidding-login-finished', { sessionId, url });
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

        const startUrl = 'https://www.comprasnet.gov.br/seguro/loginPortalFornecedor.asp';
        win.loadURL(startUrl);
    }

    sendManualBid({ purchaseId, itemId, value }) {
        this.sessions.forEach(session => {
            if (session.window && !session.window.isDestroyed()) {
                session.window.webContents.send('manual-bid', { purchaseId, itemId, value });
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
