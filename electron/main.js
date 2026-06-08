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
let globalComprasId = ''; // Session UUID compartilhado entre janelas

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
    // Em produção, usamos url.pathToFileURL para garantir que espaços e acentos no caminho
    // sejam convertidos corretamente para o protocolo file:// (Evita ERR_FILE_NOT_FOUND)
    const url = require('url');
    const desktopPath = path.join(__dirname, '../dist_electron/desktop.html');
    mainWindow.loadURL(url.pathToFileURL(desktopPath).href);
  }

  // In Dev, open Developer Tools
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle visual "Premium" touches
  mainWindow.on('page-title-updated', (e) => e.preventDefault());

  // Check for updates
  if (!isDev) {
    autoUpdater.requestHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    // Verificação instantânea: 1º check em 1s, depois a cada 8s
    function doCheck() {
      console.log('[POLARYON-UPDATE] Verificando em ' + autoUpdater.getFeedURL?.() || 'feed configurado');
      autoUpdater.checkForUpdatesAndNotify();
    }
    
    // 1ª verificação: após 1s (app pronto)
    setTimeout(doCheck, 1000);
    
    // Retry automático se erro na última verificação (a cada 8s até 10 tentativas)
    let retryCount = 0;
    const maxRetries = 10;
    autoUpdater.on('error', function retryHandler(err) {
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`[POLARYON-UPDATE] Retry ${retryCount}/${maxRetries} em 8s...`);
        setTimeout(doCheck, 8000);
      } else {
        console.log('[POLARYON-UPDATE] Máximo de retries atingido. Aguardando próximo ciclo.');
        retryCount = 0;
      }
    });
    
    // A cada 8s verifica novamente — atualização quase instantânea
    setInterval(() => {
        retryCount = 0;
        doCheck();
    }, 8 * 1000);
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
  session.fromPartition('persist:polaryon-global').webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    // Se a requisição for de handoff ou login, injetamos a autoridade necessária
    if (details.url.includes('dispensa_eletronica.asp') || details.url.includes('comprasnet-web/seguro') || details.url.includes('servico=226') || details.url.includes('login_f.asp')) {
      details.requestHeaders['Referer'] = 'https://www.comprasnet.gov.br/main.asp';
      details.requestHeaders['Origin'] = 'https://www.comprasnet.gov.br';
      details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
      details.requestHeaders['Sec-Fetch-Site'] = 'same-origin';
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  createWindow();

  // 🌐 Rastreia compras-id (session UUID) em TODAS as janelas, incluindo child windows do portal Serpro
  app.on('web-contents-created', (event, contents) => {
    contents.on('did-navigate', (event, url) => {
      const m = url.match(/[?&]compras-id=([a-f0-9-]+)/i);
      if (m && m[1]) {
        globalComprasId = m[1];
        console.log('[MAIN] 📍 compras-id capturado de navegação: ' + globalComprasId);
      }
    });
    contents.on('did-navigate-in-page', (event, url) => {
      const m = url.match(/[?&]compras-id=([a-f0-9-]+)/i);
      if (m && m[1]) {
        globalComprasId = m[1];
        console.log('[MAIN] 📍 compras-id capturado de SPA navigation: ' + globalComprasId);
      }
    });
  });

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
    biddingRunner.focusedSessionId = sessionId;
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
  // Também repassa para o motor global (Visual Mode) - v3.8.2
  if (global.biddingRunner && global.biddingRunner !== biddingRunner) {
    global.biddingRunner.updateConfig(sessionId, config);
  }
  if (visualRunner) {
    visualRunner.updateConfig(sessionId, config);
  }
});

// [FOCO DE SESSÃO] Notifica o motor qual sala está sendo monitorada ativamente (Anti-429 v3.8.2)
ipcMain.on('set-focused-session', (event, sessionId) => {
  if (biddingRunner) biddingRunner.focusedSessionId = sessionId;
  if (global.biddingRunner) global.biddingRunner.focusedSessionId = sessionId;
  console.log(`[POLARYON] 🎯 Sessão focada definida: ${sessionId}`);
});

// VISUAL AUTOMATION IPC HANDLERS (Siga Pregão Mode)
const VisualRunner = require('./visual-runner');
let visualRunner;

ipcMain.on('start-visual-bidding', async (event, { sessionId, uasg, numero, ano, vault, modality }) => {
  if (!visualRunner) {
    visualRunner = new VisualRunner(mainWindow.webContents);
  }
  
  visualRunner.startVisualSession(sessionId, { uasg, numero, ano, modality, vault });

  // 🚀 MODO SIGA-PREGÃO: Dispara o Motor Rest de Background
  const BiddingRunner = require('./bidding-runner');
  if (!global.biddingRunner) {
      global.biddingRunner = new BiddingRunner(mainWindow.webContents);
  }
  global.biddingRunner.focusedSessionId = sessionId; // Registra foco inicial (v3.8.2)
  global.biddingRunner.start(sessionId, uasg, numero, ano, vault, modality);
});

// [SIGA AUTO-DETECTION] RELAY PARA O DASHBOARD
ipcMain.on('portal-detected-room', (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bidding-detected-room', data);
    }
});

// [BRIDGE DIRETA] RELAY DE DADOS DO NAVEGADOR PARA O DASHBOARD (v3.6.27)
ipcMain.on('send-portal-data', (event, data) => {
    if (data && data.type === 'ws-item-data' && data.codigo && Array.isArray(data.items)) {
        if (biddingRunner && typeof biddingRunner.injectRealtimeItems === 'function') {
            biddingRunner.injectRealtimeItems(data.codigo, data.items);
        }
        if (global.biddingRunner && global.biddingRunner !== biddingRunner && typeof global.biddingRunner.injectRealtimeItems === 'function') {
            global.biddingRunner.injectRealtimeItems(data.codigo, data.items);
        }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('portal-data-update', data);
    }
});

// 🔄 FALLBACK VIA INVOKE: ipcMain.handle usa mecanismo diferente de on (v3.8.197)
ipcMain.handle('ws-item-data-invoke', (event, { codigo, items }) => {
    if (codigo && Array.isArray(items)) {
        let routed = 0;
        if (biddingRunner && typeof biddingRunner.injectRealtimeItems === 'function') {
            biddingRunner.injectRealtimeItems(codigo, items);
            routed++;
        }
        if (global.biddingRunner && global.biddingRunner !== biddingRunner && typeof global.biddingRunner.injectRealtimeItems === 'function') {
            global.biddingRunner.injectRealtimeItems(codigo, items);
            routed++;
        }
    }
    return { ok: true };
});

// 🎯 RELAY DE DADOS DO WEBSOCKET PARA O MOTOR DE LANCES (v3.8.130)
ipcMain.on('ws-item-data', (event, { codigo, items }) => {
    console.log(`[WS DIAG] 🎯 IPC recebeu WS data (raw): codigo=${typeof codigo} items=${typeof items} isArray=${Array.isArray(items)}`);
    if (codigo && Array.isArray(items)) {
        console.log(`[WS DIAG] 🎯 IPC recebeu WS data: ${codigo} (${items.length} itens)`);
        let routed = 0;
        if (biddingRunner && typeof biddingRunner.injectRealtimeItems === 'function') {
            biddingRunner.injectRealtimeItems(codigo, items);
            routed++;
        }
        if (global.biddingRunner && global.biddingRunner !== biddingRunner && typeof global.biddingRunner.injectRealtimeItems === 'function') {
            global.biddingRunner.injectRealtimeItems(codigo, items);
            routed++;
        }
        console.log(`[WS DIAG] ✅ Roteado para ${routed} BiddingRunner(s)`);
    } else {
        console.warn(`[WS DIAG] ⚠️ Condição falhou: codigo=${!!codigo} isArray=${Array.isArray(items)} items.length=${items?.length}`);
    }
});

// 🔬 TESTE IPC: ping do portal-preload para verificar conectividade
ipcMain.on('ws-ping', (event, data) => {
    console.log(`[WS DIAG] 🏓 IPC PING recebido do portal-preload! data=${JSON.stringify(data)}`);
});

// ⚡ RAIO DIRETO: dados mínimos do WebSocket para display instantâneo no frontend
ipcMain.on('ws-fast-bid', (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ws-fast-bid', data);
    }
});

// 🎯 NOTIFICAÇÃO DE LANCE ENVIADO PELO FRONTEND → atualiza cooldown do backend (v3.8.130)
ipcMain.on('bid-sent', (event, { purchaseId, itemId, value }) => {
    if (biddingRunner && typeof biddingRunner.notifyBidSent === 'function') {
        biddingRunner.notifyBidSent(purchaseId, itemId, value);
    }
    if (global.biddingRunner && global.biddingRunner !== biddingRunner && typeof global.biddingRunner.notifyBidSent === 'function') {
        global.biddingRunner.notifyBidSent(purchaseId, itemId, value);
    }
});

// [GATILHO MANUAL] RELAY: Prioriza Visual Runner (BrowserView), fallback bidding-runner
ipcMain.on('manual-bid', (event, data) => {
    if (visualRunner) {
        visualRunner.sendManualBid(data);
    } else if (global.biddingRunner) {
        // Notifica cooldown antes de enviar (evita duplicação se RoomRunner também estiver ativo)
        const runner = global.biddingRunner;
        if (data.purchaseId && data.itemId && data.value) {
            runner.notifyBidSent(data.purchaseId, data.itemId, data.value);
        }
        runner.sendBid(data);
    }
});

// FORNECE CAPTCHA DO SIGA PARA O PORTAL-PRELOAD (v3.8.25)
ipcMain.handle('get-captcha-token', async () => {
    try {
        const BiddingRunner = require('./bidding-runner');
        const tokens = await BiddingRunner.getCaptchaTokens();
        if (tokens && tokens.captcha1) return tokens.captcha1;
        const fresh = await BiddingRunner.getFreshCaptchaToken();
        return fresh || null;
    } catch (e) {
        console.error('[MAIN] Erro ao obter captcha:', e.message);
        return null;
    }
});

// DIAGNÓSTICO DE CAPTCHA: Testa cada variant da URL do ranking e retorna resultados (v3.8.30)
ipcMain.handle('test-ranking-captcha', async (event, { purchaseId, itemId, token }) => {
    const results = [];
    const variants = [
        { name: 'captcha1/2/3', url: `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemId}/lances/por-participante?captcha1=${token}&captcha2=${token}&captcha3=${token}&tamanhoPagina=50&pagina=0` },
        { name: 'captcha singular', url: `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemId}/lances/por-participante?captcha=${token}&tamanhoPagina=50&pagina=0` },
        { name: 'sem captcha', url: `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemId}/lances/por-participante?tamanhoPagina=50&pagina=0` },
        { name: 'propostas-iniciais', url: `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/v1/compras/${purchaseId}/itens/${itemId}/propostas-iniciais?tamanhoPagina=50&pagina=0` },
    ];
    for (const v of variants) {
        try {
            const res = await fetch(v.url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0 SIGAClient/0.7.2',
                    'Accept': 'application/json',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                },
                signal: AbortSignal.timeout(5000)
            });
            const body = await res.text().catch(() => '');
            results.push({ name: v.name, status: `${res.status} ${res.statusText}`, body: body.substring(0, 300) });
        } catch (e) {
            results.push({ name: v.name, status: 'ERRO', body: e.message });
        }
    }
    return results;
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
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bidding-update-log', '🔎 Verificando servidores da Polaryon...');
    }
});

autoUpdater.on('update-available', (info) => {
    console.log('[POLARYON-UPDATE] Atualização disponível v' + info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', info);
        mainWindow.webContents.send('bidding-update-log', `✅ Nova versão v${info.version} encontrada! Iniciando download...`);
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
        mainWindow.webContents.send('bidding-update-log', '👌 Você já está na versão mais recente (v' + app.getVersion() + ')');
    }
});

autoUpdater.on('error', (err) => {
    console.error('[POLARYON-UPDATE] Erro no atualizador:', err);
    
    // 🛡️ TRATAMENTO EBUSY: Se o Windows travar o arquivo, tentamos avisar e limpar
    if (err.message.includes('EBUSY') || err.message.includes('locked')) {
        console.log('[POLARYON-UPDATE] Detectado recurso travado. Sugerindo limpeza manual.');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bidding-update-log', '⚠️ O Windows travou o instalador. Por favor, reinicie o computador ou feche o app e tente novamente.');
        }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-error', err.message);
        mainWindow.webContents.send('bidding-update-log', '❌ Erro na atualização: ' + (err.message || 'Falha de rede'));
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    console.log(`[POLARYON-UPDATE] Baixando: ${Math.round(progressObj.percent)}%`);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', progressObj);
        mainWindow.webContents.send('bidding-update-log', `⏳ Baixando: ${Math.round(progressObj.percent)}% (${Math.round(progressObj.bytesPerSecond / 1024)} KB/s)`);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('[POLARYON-UPDATE] Atualização v' + info.version + ' baixada.');
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded', info);
        mainWindow.webContents.send('bidding-update-log', `🚀 v${info.version} PRONTA! Reiniciando em 10s para aplicar...`);
        
        // ⚡ INSTALAÇÃO AUTOMÁTICA FORÇADA
        setTimeout(() => {
            autoUpdater.quitAndInstall(false, true);
        }, 10000);
    }
    new Notification({
        title: 'Polaryon - Atualização Pronta',
        body: 'O robô será reiniciado em 10 segundos para aplicar a v' + info.version
    }).show();
});

ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.on('check-for-updates', () => {
    console.log('[POLARYON-UPDATE] Verificação manual solicitada.');
    autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// 🔑 SESSION UUID SHARING: Preload enuncia e child windows consultam
ipcMain.on('store-session-uuid', (event, uuid) => {
  if (uuid && uuid.match(/^[a-f0-9-]+$/i)) {
    globalComprasId = uuid;
    console.log('[MAIN] 💾 compras-id armazenado via IPC: ' + globalComprasId);
  }
});

ipcMain.handle('get-compras-id', () => {
  return globalComprasId || '';
});
