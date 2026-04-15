const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const isDev = !app.isPackaged;
const BiddingRunner = require('./bidding-runner');
const sessionStore = require('./session-store');
const certHelper = require('./cert-helper');
const secureProxy = require('./secure-proxy');

let biddingRunner;
let mainWindow;

// Configure autoUpdater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Polaryon - Robô de Lances",
    icon: path.join(__dirname, '../public/favicon.ico'), 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    backgroundColor: '#020817', // Mantemos escuro mas podemos usar #064e3b para debug
    autoHideMenuBar: true,
  });

  // EM PRODUÇÃO: Permitimos abrir o DevTools para diagnosticar a tela preta
  mainWindow.webContents.openDevTools();

  // Initialize Bidding Runner
  biddingRunner = new BiddingRunner(mainWindow.webContents);

  // Decide what to load
  if (isDev) {
    // No dev, o terminal roda no servidor local do Vite
    mainWindow.loadURL('http://localhost:5173/desktop.html');
  } else {
    // Em produção, carregamos os arquivos BUILIDADOS locais (Puro e Ultra-Leve)
    mainWindow.loadFile(path.join(__dirname, '../dist/desktop.html'));
  }

  // In Dev, open Developer Tools
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle visual "Premium" touches
  mainWindow.on('page-title-updated', (e) => e.preventDefault());

  // Check for updates
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// Configuração de Deep Linking
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('polaryon', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('polaryon')
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    
    // Windows: o link polaryon:// pode estar em qualquer posição da commandLine
    const url = commandLine.find(arg => arg.startsWith('polaryon://'));
    if (url) {
        handleDeepLink(url);
    }
  });
}

function handleDeepLink(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('polaryon://')) return;
  
  console.log(`[MAIN] Processando Deep Link: ${url}`);
  
  try {
    const rawUrl = url.replace('polaryon://', 'http://localhost/');
    const parsedUrl = new URL(rawUrl);
    const action = parsedUrl.pathname.replace('/', '');
    
    if (action === 'combat') {
      const uasg = parsedUrl.searchParams.get('uasg');
      const numero = parsedUrl.searchParams.get('numero');
      const ano = parsedUrl.searchParams.get('ano');
      
      if (uasg && numero && mainWindow) {
        const sessionId = require('crypto').randomUUID();
        
        // Garante que o visualRunner está pronto
        if (!visualRunner) {
            const VisualRunner = require('./visual-runner');
            visualRunner = new VisualRunner(mainWindow.webContents);
        }
        
        console.log(`[MAIN] Disparando Sessão Visual: UASG=${uasg}, Nº=${numero}`);
        visualRunner.startVisualSession(sessionId, { 
            uasg, 
            numero, 
            ano: ano || new Date().getFullYear().toString(), 
            modality: '05', 
            vault: {} 
        });
      }
    }
  } catch (e) {
    console.error("Deep link parse error:", e);
  }
}

app.whenReady().then(async () => {
  // Inicializa o Proxy Seguro para suporte a A1
  await secureProxy.start();
  
  createWindow();

  // Handle Windows Deep Link on First Launch
  const urlArg = process.argv.find(arg => arg.startsWith('polaryon://'));
  if (urlArg) {
      setTimeout(() => { handleDeepLink(urlArg); }, 2000);
  }

  // Habilita F12 Global para todas as janelas (Modo Debug Ativo)
  const { globalShortcut } = require('electron');
  globalShortcut.register('F12', () => {
    const wins = BrowserWindow.getAllWindows();
    wins.forEach(w => w.webContents.toggleDevTools());
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handling macOS deep links
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// IPC Handler for native notifications
ipcMain.on('show-notification', (event, { title, body }) => {
  new Notification({ title, body }).show();
});

// LOCAL BIDDING IPC HANDLERS (Headless API - Deprecated for 14.133, kept for legacy)
ipcMain.on('start-local-bidding', async (event, { sessionId, uasg, numero, ano, vault, modality }) => {
  if (biddingRunner) {
    await biddingRunner.start(sessionId, uasg, numero, ano, vault, modality);
    sessionStore.save(biddingRunner.activeSessions);
  }
});

ipcMain.on('stop-local-bidding', (event, sessionId) => {
  if (biddingRunner) {
    biddingRunner.stop(sessionId);
    sessionStore.save(biddingRunner.activeSessions);
  }
});

ipcMain.on('update-local-config', (event, { sessionId, config }) => {
  if (biddingRunner) {
    biddingRunner.updateConfig(sessionId, config);
    sessionStore.save(biddingRunner.activeSessions);
  }
  if (visualRunner) {
    visualRunner.updateConfig(sessionId, config);
  }
});

// VISUAL AUTOMATION IPC HANDLERS (Siga Pregão Mode)
const VisualRunner = require('./visual-runner');
let visualRunner;

ipcMain.on('start-visual-bidding', async (event, { sessionId, uasg, numero, ano, vault, modality }) => {
  if (!visualRunner) {
    visualRunner = new VisualRunner(mainWindow.webContents);
  }
  
  // Configura a sessão para usar o Proxy de MTLS se o certificado existir
  if (certHelper.hasCertificate()) {
    const ses = require('electron').session.fromPartition('persist:comprasgov');
    await ses.setProxy({ 
        proxyRules: secureProxy.getProxyUrl(),
        proxyBypassRules: 'localhost, 127.0.0.1'
    });
  }

  visualRunner.startVisualSession(sessionId, { uasg, numero, ano, modality, vault });
});

// GESTÃO DE CERTIFICADO A1
ipcMain.handle('save-a1-certificate', async (event, { fileName, buffer, password }) => {
  return certHelper.saveCertificate(fileName, Buffer.from(buffer), password);
});

ipcMain.handle('has-a1-certificate', () => {
  return certHelper.hasCertificate();
});

ipcMain.on('stop-visual-bidding', (event, sessionId) => {
  if (visualRunner) {
    visualRunner.stop(sessionId);
  }
});

ipcMain.handle('get-restored-sessions', () => {
  return sessionStore.load();
});

// AUTO-UPDATER EVENTS
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
  mainWindow.webContents.send('update-not-available', info);
});

autoUpdater.on('error', (err) => {
  mainWindow.webContents.send('update-error', err.message);
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow.webContents.send('update-downloaded', info);
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});
