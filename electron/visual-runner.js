const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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

        // Listener para Cliques Nativos de Elite (v2)
        ipcMain.on('portal-native-click', (event, { sessionId, x, y }) => {
            const session = this.sessions.get(sessionId);
            if (session && session.window) {
                console.log(`[POLARYON-WAR] Executando CLIQUE ELITE (v2) em: X=${Math.round(x)}, Y=${Math.round(y)}`);
                
                const wc = session.window.webContents;
                const pos = { x: Math.round(x), y: Math.round(y) };

                // Sequência de Elite: Move -> Down -> Up
                wc.sendInputEvent({ type: 'mouseMove', ...pos });
                
                setTimeout(() => {
                    wc.sendInputEvent({ type: 'mouseDown', ...pos, button: 'left', clickCount: 1 });
                    setTimeout(() => {
                        wc.sendInputEvent({ type: 'mouseUp', ...pos, button: 'left', clickCount: 1 });
                    }, 50);
                }, 50);
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

        const win = new BrowserWindow({
            width: 1280,
            height: 900,
            title: `Polaryon - Modo Visual (Pregão/Dispensa ${config.numero}/${config.ano})`,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, 'portal-preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false,
                allowRunningInsecureContent: true,
                // Partição única por sessão para permitir multilocação ou particionamento persistente padrão
                partition: 'persist:comprasgov' 
            }
        });

        this.sessions.set(sessionId, { window: win, config });

        // --- INTERCEPTADOR DE POPUPS ---
        // O Serpro costuma abrir o módulo de Disputa em nova aba/janela (`target="_blank"`),
        // o que faria o Electron abrir uma janela limpa sem o nosso `preload`.
        // Nós interceptamos esse "PopUp" e forçamos a abrir na *mesma janela*,
        // assim o Robô nunca desgruda da sessão.
        // RECONSTRUÇÃO v1.2.50: Redirecionamento Automático e Silencioso (Competition Grade)
        win.webContents.setWindowOpenHandler(({ url }) => {
            // Se o portal tentar abrir uma nova aba (Disputa), forçamos na mesma janela
            if (url.includes('comprasnet-web') || url.includes('disputa')) {
                console.log('[POLARYON-NAV] Transição automática detectada para:', url);
                // Carregamos na janela atual sem perguntar
                win.loadURL(url);
                return { action: 'deny' }; // Bloqueia a abertura da nova janela física
            }
            
            // Links externos (ajuda, legislação) continuam abrindo fora
            return { action: 'allow' };
        });

        // Injetor de Silenciador de Diálogos Global
        win.webContents.on('did-start-navigation', () => {
            win.webContents.executeJavaScript(`
                window.alert = () => { console.log("Alert silenciado") };
                window.confirm = () => { return true };
                window.prompt = () => { return null };
            `);
        });

        // Habilita o Console (DevTools) automaticamente para o usuário monitorar os erros
        win.webContents.openDevTools();

        // Atalho F12 para alternar o console
        win.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12' && input.type === 'keyDown') {
                win.webContents.toggleDevTools();
                event.preventDefault();
            }
        });

        win.on('closed', () => {
            this.sessions.delete(sessionId);
            
            // Avisa o dashboard que a janela específica foi fechada
            if (this.dashboardWebContents) {
                this.dashboardWebContents.send('bidding-error', { 
                    sessionId, 
                    error: 'Janela Operacional Fechada pelo usuário.' 
                });
            }
        });

        win.webContents.on('did-finish-load', () => {
            win.webContents.send('init-session', { sessionId, config });
        });

        // TENTATIVA DE SALTO AUTOMÁTICO (Elite Gateway)
        // Se após 3 segundos o robô detectar que parou na intro, ele força o salto SSO
        win.webContents.on('did-finish-load', () => {
            const currentUrl = win.webContents.getURL();
            if (currentUrl.includes('intro.htm')) {
                console.log('[POLARYON-WAR] Detectada Estagnação na Intro. Aplicando ' + '"' + 'Salto de Elite' + '"' + '...');
                setTimeout(() => {
                    // Força o carregamento do serviço 226 (Handoff SSO)
                    // O Hijacker no main.js cuidará dos cabeçalhos.
                    win.loadURL('https://www.comprasnet.gov.br/seguro/index_f.asp?servico=226');
                }, 1500);
            }
        });

        const startUrl = 'https://www.comprasnet.gov.br/seguro/loginPortalFornecedor.asp';
        console.log(`[VISUAL RUNNER] Navegando Inicialmente para: ${startUrl}`);
        
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
}

module.exports = VisualRunner;
