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
try {
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://polaryon.com.br/download/'
  });
} catch (e) {
  console.error('[POLARYON] Erro ao configurar Feed de Update:', e);
}

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
    // Check every 30 mins
    setInterval(() => {
        autoUpdater.checkForUpdatesAndNotify();
    }, 30 * 60 * 1000);
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
  
  // EQUIPAMENTO DE ELITE: Hijacker de Sessão (Referer/Origin Persistence)
  // Isso garante que o portal aceite o salto direto para o 'servico=226'
  const filter = {
    urls: ['*://*.comprasnet.gov.br/*', '*://*.serpro.gov.br/*']
  };

  const { session } = require('electron');
  session.fromPartition('persist:comprasgov').webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    // Se a requisição for de handoff ou login, injetamos a autoridade necessária
    if (details.url.includes('servico=226') || details.url.includes('login_f.asp')) {
      details.requestHeaders['Referer'] = 'https://www.comprasnet.gov.br/seguro/intro.htm';
      details.requestHeaders['Origin'] = 'https://www.comprasnet.gov.br';
      details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
      details.requestHeaders['Sec-Fetch-Site'] = 'same-origin';
    }
    callback({ requestHeaders: details.requestHeaders });
  });

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


// Bypass de erro de certificado para portais do governo
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.includes('comprasnet.gov.br') || url.includes('gov.br') || url.includes('serpro.gov.br')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Auto-seleção nativa de Certificado Digital (A1/A3) instalado no Windows
app.on('select-client-certificate', (event, webContents, url, list, callback) => {
  event.preventDefault();
  if (list && list.length > 0) {
    console.log('[POLARYON] Certificado Auto-Selecionado:', list[0].subjectName);
    callback(list[0]);
  } else {
    callback();
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
  
  // REMOVIDO: O secure-proxy não suporta HTTP CONNECT e causava a Tela Branca.
  // Em vez disso, usaremos o gerenciamento nativo do Electron e o bypass de certificado.

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
    console.log('[POLARYON-UPDATE] Verificando se há atualizações...');
});

autoUpdater.on('update-available', (info) => {
    console.log('[POLARYON-UPDATE] Atualização disponível v' + info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', info);
    }
    new Notification({
        title: 'Polaryon - Atualização detectada',
        body: 'Uma nova versão (' + info.version + ') está sendo baixada automaticamente.'
    }).show();
});

autoUpdater.on('update-not-available', (info) => {
    console.log('[POLARYON-UPDATE] Nenhuma atualização pendente (v' + app.getVersion() + ')');
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-not-available', info);
    }
});

autoUpdater.on('error', (err) => {
    console.error('[POLARYON-UPDATE] Erro no atualizador:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-error', err.message);
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    console.log(`[POLARYON-UPDATE] Baixando: ${Math.round(progressObj.percent)}%`);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', progressObj);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('[POLARYON-UPDATE] Atualização v' + info.version + ' baixada.');
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded', info);
    }
    new Notification({
        title: 'Polaryon - Tudo pronto!',
        body: 'A nova versão foi baixada. O robô será atualizado ao fechar.'
    }).show();
});

ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});
