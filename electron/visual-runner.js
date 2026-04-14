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
                // Partição única por sessão para permitir multilocação ou particionamento persistente padrão
                partition: 'persist:comprasgov' 
            }
        });

        this.sessions.set(sessionId, { window: win, config });

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

        win.loadURL('https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras');
    }

    stop(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            if (session.window) session.window.close();
            this.sessions.delete(sessionId);
        }
    }
}

module.exports = VisualRunner;
