const { app, BrowserWindow, ipcMain, Notification, session } = require('electron');
const https = require('https');
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

// v3.8.260: força destruição de TODAS as janelas antes do quit (evita trava do instalador NSIS)
app.on('before-quit', () => {
  console.log('[MAIN] before-quit: destruindo todas as janelas...');
  BrowserWindow.getAllWindows().forEach(function(w) {
    try { if (!w.isDestroyed()) w.destroy(); } catch(e) {}
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
    // 🔑 JWT renovado proativamente (v3.8.252)
    if (data && data.type === 'session-token' && data.token) {
        const freshToken = data.token.startsWith('Bearer ') ? data.token : 'Bearer ' + data.token;
        global.serproToken = freshToken;
        console.log('[MAIN] 🔑 Token atualizado proativamente. len=' + freshToken.length);
        const runners = [biddingRunner, global.biddingRunner].filter(Boolean);
        for (const r of runners) {
            if (r && typeof r.setToken === 'function') r.setToken(freshToken);
            else if (r) r.serproToken = freshToken;
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
        
        setTimeout(() => {
            console.log('[POLARYON-UPDATE] Destruindo todas as janelas...');
            BrowserWindow.getAllWindows().forEach(function(w) {
                try { if (!w.isDestroyed()) w.destroy(); } catch(e) {}
            });
            
            // ⚡ UPDATE NUCLEAR (v3.8.263): PowerShell script que mata o processo e executa o instalador
            // app.quit() é assíncrono — o NSIS installer espera o processo morrer mas o app demora
            // Solução: spawn PowerShell detached, depois app.exit(0) síncrono
            const { spawn } = require('child_process');
            const fs = require('fs');
            const tempDir = app.getPath('temp');
            const appData = app.getPath('appData');
            
            const psScript = `Start-Sleep -Seconds 3
$pendingDirs = @(
    "$env:APPDATA\\Polaryon\\electron-updater\\pending",
    "$env:LOCALAPPDATA\\electron-updater\\pending",
    "$env:APPDATA\\electron-updater\\pending",
    "$env:LOCALAPPDATA\\Polaryon\\electron-updater\\pending"
)
$installer = $null
foreach ($dir in $pendingDirs) {
    if (Test-Path $dir) {
        $exes = Get-ChildItem -Path $dir -Filter "*.exe" | Sort-Object LastWriteTime -Descending
        if ($exes.Length -gt 0) {
            $installer = $exes[0].FullName
            break
        }
    }
}
if ($installer) {
    taskkill /F /IM Polaryon.exe 2>$null
    Start-Sleep -Seconds 2
    Start-Process -Wait -NoNewWindow -FilePath $installer -ArgumentList "/S"
    Start-Process "$env:LOCALAPPDATA\\Programs\\polaryon\\Polaryon.exe"
} else {
    # Fallback: tenta quitAndInstall se não achou instalador
    Start-Sleep -Seconds 3
    $installer = $null
    foreach ($dir in $pendingDirs) {
        if (Test-Path $dir) {
            $exes = Get-ChildItem -Path $dir -Filter "*.exe" | Sort-Object LastWriteTime -Descending
            if ($exes.Length -gt 0) {
                $installer = $exes[0].FullName
                break
            }
        }
    }
    if ($installer) {
        taskkill /F /IM Polaryon.exe 2>$null
        Start-Sleep -Seconds 2
        Start-Process -Wait -NoNewWindow -FilePath $installer -ArgumentList "/S"
        Start-Process "$env:LOCALAPPDATA\\Programs\\polaryon\\Polaryon.exe"
    }
}`;
            
            const psPath = path.join(tempDir, 'polaryon-update.ps1');
            try {
                fs.writeFileSync(psPath, psScript, 'utf8');
                spawn('powershell.exe', [
                    '-ExecutionPolicy', 'Bypass',
                    '-File', psPath
                ], {
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true
                });
                console.log('[POLARYON-UPDATE] Script PowerShell spawnado. Saindo com app.exit(0)...');
            } catch(e) {
                console.error('[POLARYON-UPDATE] Erro ao criar script PowerShell:', e);
            }
            
            // ⚡ app.exit() é SÍNCRONO — mata o processo imediatamente
            app.exit(0);
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

ipcMain.handle('get-stored-token', () => {
  return global.serproToken || '';
});

ipcMain.handle('scan-cookies', async () => {
  try {
    const allCookies = await session.fromPartition('persist:polaryon-global').cookies.get({});
    return allCookies.map(c => ({ name: c.name, value: c.value, domain: c.domain }));
  } catch(e) {
    return [];
  }
});

// 🔄 JWT REFRESH VIA HIDDEN BROWSERWINDOW (v3.8.268): navega para main.asp (SSO)
// A hidden window usa a MESMA sessão da janela principal (cookies compartilhados).
// main.asp → redirect → www SPA → SSO → novo JWT. Main window NÃO é afetada.
ipcMain.handle('refresh-jwt-via-page', async (event) => {
  var hiddenWinToken = null;
  const diag = (msg) => {
    console.log('[MAIN-RELOAD] ' + msg);
    try { event.sender.send('main-diag', msg); } catch(e) {}
  };
  try {
    const mainSession = session.fromPartition('persist:polaryon-global');
    const { BrowserWindow } = require('electron');
    const hiddenWin = new BrowserWindow({
      show: false,
      width: 1024, height: 768,
      webPreferences: {
        session: mainSession,
        preload: path.join(__dirname, 'hidden-preload.js'),
        javascript: true,
        sandbox: false,
        webSecurity: true
      }
    });

    // Navega para cnetmobile SPA (mesma sessão da janela principal)
    diag('🔄 Navegando para cnetmobile SPA (mesma sessão)...');
    try {
      await hiddenWin.loadURL('https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/compras', { timeout: 25000 });
    } catch(e) {
      diag('⚠️ cnetmobile (continuando): ' + e.message);
    }

    // Aguarda SPA carregar + estabilizar (até 20s)
    await new Promise(r => setTimeout(r, 5000));

    // Polling: extrai JWT do sessionStorage + interceptor hidden-preload (60 tentativas)
    for (var attempt = 0; attempt < 60; attempt++) {
      try {
        // Log URL a cada 10 tentativas para diagnóstico
        if (attempt % 10 === 0) {
          try { var curUrl = await hiddenWin.webContents.executeJavaScript('location.href.substring(0,120)'); diag('📍 URL at #' + (attempt+1) + ': ' + curUrl); } catch(e3) { diag('📍 URL at #' + (attempt+1) + ': (cross-origin)'); }
        }
        var result = await hiddenWin.webContents.executeJavaScript('(function() { try { var keys = Object.keys(sessionStorage); for (var i = 0; i < keys.length; i++) { var val = sessionStorage.getItem(keys[i]); if (val && typeof val === \'string\' && val.length > 100 && val.indexOf(\'.\') > 0) { try { var parts = val.split(\'.\'); var payload = JSON.parse(atob(parts[1].replace(/-/g, \'+\').replace(/_/g, \'/\'))); var expSec = payload.exp; if (expSec && (expSec - Date.now()/1000) > 180) { return { key: keys[i], token: val, storage: \'sessionStorage\', ttl: Math.floor(expSec - Date.now()/1000) }; } } catch(e) {} return { key: keys[i], token: val, storage: \'sessionStorage\' }; } } } catch(e) {} try { if (window.__polaryonBearer && typeof window.__polaryonBearer === \'string\' && window.__polaryonBearer.length > 50) { return { key: \'__polaryonBearer\', token: window.__polaryonBearer, storage: \'hiddenPreload\' }; } } catch(e) {} return null; })()');
        if (result && result.token) {
          var token = result.token.startsWith('Bearer ') ? result.token : 'Bearer ' + result.token;
          hiddenWinToken = token;
          diag('✅ JWT fresco! key=' + result.key + ' ttl=' + (result.ttl || 'N/A') + 's');
          try { if (!hiddenWin.isDestroyed()) hiddenWin.destroy(); } catch(e) {}
          return token;
        }
        diag('⏳ Tentativa ' + (attempt + 1) + '/60 — JWT nao encontrado');
        await new Promise(r => setTimeout(r, 1000));
      } catch(e2) {
        diag('⏳ Tentativa ' + (attempt + 1) + '/60 — aguardando (cross-origin): ' + e2.message);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    diag('❌ Timeout — JWT nao gerado apos ~60s');
    try { if (!hiddenWin.isDestroyed()) hiddenWin.destroy(); } catch(e) {}
    return null;
  } catch(e) {
    console.log('[MAIN-RELOAD] Erro: ' + e.message);
    return null;
  }
});

// ☢️ RELOAD DA JANELA PRINCIPAL + POLL (v3.8.260): limpa localStorage+sessionStorage,
// reload, e espera até 20s pelo novo JWT gerado pelo SSO.
// Retorna o token encontrado ou null.
ipcMain.handle('reload-main-window', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      // Salva a URL ANTES do reload para poder voltar depois
      const savedUrl = win.webContents.getURL();
      console.log('[MAIN] ☢️ reload-main-window: limpando storages + reload + poll... URL salva: ' + savedUrl);

      global.serproToken = null;
      try {
        await win.webContents.executeJavaScript('(function(){ try{localStorage.clear()}catch(e){} try{sessionStorage.clear()}catch(e){} try{indexedDB&&indexedDB.databases&&indexedDB.databases().then(function(dbs){dbs.forEach(function(db){if(db.name)indexedDB.deleteDatabase(db.name)})})}catch(e){} return true; })()');
      } catch(e) {
        console.log('[MAIN] ☢️ storage.clear ignorado:', e.message);
      }
      win.webContents.reload();
      // Poll por até 30s pelo global.serproToken (preload captura token da SPA e envia p/ main process)
      var foundToken = null;
      for (var a = 0; a < 30; a++) {
        await new Promise(function(r) { setTimeout(r, 1000); });
        try {
          if (win.isDestroyed()) break;
          if (!foundToken && global.serproToken && typeof global.serproToken === 'string' && global.serproToken.startsWith('Bearer ') && global.serproToken.length > 60) {
            foundToken = global.serproToken;
            console.log('[MAIN] ☢️ reload-main-window: JWT fresco encontrado via interceptor!');
          }
        } catch(e2) {}
      }

      // ⬅️ SEMPRE volta para a URL original, mesmo sem token (v3.8.266)
      // O SPA recarrega na página certa, detecta auth ausente, e o interceptor captura o novo JWT
      try {
        if (!win.isDestroyed()) {
          var currentUrl = win.webContents.getURL();
          if (currentUrl && savedUrl && currentUrl !== savedUrl) {
            console.log('[MAIN] ☢️ reload-main-window: URL mudou para "' + currentUrl.substring(0,80) + '", navegando de volta para "' + savedUrl.substring(0,80) + '"...');
            win.webContents.loadURL(savedUrl);
            await new Promise(function(r2) { setTimeout(r2, 3000); });
          }
        }
      } catch(e3) {
        console.log('[MAIN] ☢️ reload-main-window: erro ao navegar de volta:', e3.message);
      }

      if (foundToken) return foundToken;
      console.log('[MAIN] ☢️ reload-main-window: JWT nao encontrado apos 30s (URL restaurada)');
      return null;
    }
    console.log('[MAIN] ☢️ reload-main-window: janela principal nao encontrada');
    return null;
  } catch(e) {
    console.log('[MAIN] ☢️ reload-main-window erro:', e.message);
    return null;
  }
});

// 🔄 JWT REFRESH VIA HTTPS DIRETO (Node.js): usa cookies da sessão Electron, sem CORS (v3.8.225)
function diag(event, msg) {
  console.log('[MAIN] ' + msg);
  try { event.sender.send('main-diag', msg); } catch(e) {}
}
ipcMain.handle('refresh-jwt', async (event, { cnetId }) => {
  if (!cnetId) return null;
  diag(event, '🔄 refresh-jwt cnet-id=' + cnetId);
  try {
    const allCookies = await session.fromPartition('persist:polaryon-global').cookies.get({});
    const serproCookies = allCookies.filter(c => c.domain && (c.domain.includes('comprasnet.gov.br') || c.domain.includes('serpro.gov.br')));
    diag(event, '🍪 Cookies Serpro: ' + serproCookies.length + ' (' + serproCookies.map(c => c.name).join(', ') + ')');
    if (serproCookies.length === 0) {
      diag(event, '❌ sem cookies Serpro — refresh impossível');
      return null;
    }
    const cookieStr = serproCookies.map(c => c.name + '=' + c.value).join('; ');
    const urlPath = '/comprasnet-usuario/v2/sessao/fornecedor/usuario/token/' + cnetId;
    // Tenta www primeiro (login origin), fallback cnetmobile (pagina atual do usuario) (v3.8.226)
    const hosts = ['www.comprasnet.gov.br', 'cnetmobile.estaleiro.serpro.gov.br'];
    const methods = ['POST', 'GET'];
    for (const hostname of hosts) {
      for (const method of methods) {
        const result = await new Promise((resolve) => {
          const opts = {
            hostname, path: urlPath, method,
            headers: {
              'Cookie': cookieStr,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
              'Accept': 'application/json, text/plain, */*',
              'Content-Type': 'application/json',
              'Referer': 'https://' + hostname + '/',
              'Origin': 'https://' + hostname,
              'x-device-platform': 'web',
              'x-version-number': '6.0.2'
            },
            timeout: 10000,
            rejectUnauthorized: true
          };
          const req = https.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
          });
          req.on('error', (e) => resolve({ status: 0, body: e.message }));
          req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
          req.end();
        });
        diag(event, '📡 Token ' + hostname + ' method=' + method + ' status=' + result.status + ' body.len=' + result.body.length);
        if (result.status === 200) {
          try {
            const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
            const token = body.token || body.accessToken || body.access_token || body.jwt || body.bearer || body.authorization || null;
            if (token) {
              diag(event, '✅ JWT renovado via ' + hostname + ' (' + method + ')');
              return token.startsWith('Bearer ') ? token : 'Bearer ' + token;
            }
            diag(event, '⚠️ 200 mas sem token. Chaves: ' + Object.keys(body).join(', '));
          } catch(e) {
            diag(event, '⚠️ Parse JSON (' + hostname + ' ' + method + '): ' + e.message + ' body: "' + String(result.body).substring(0, 200) + '"');
          }
        } else if (result.status === 401) {
          diag(event, '⚠️ 401 em ' + hostname + ' — sessão não autenticada');
        } else {
          diag(event, '⚠️ ' + hostname + ' ' + method + ' status=' + result.status + ' body="' + String(result.body).substring(0, 200) + '"');
        }
      }
    }
    diag(event, '❌ refresh-jwt falhou em todos os hosts/metodos');
    return null;
  } catch(e) {
    diag(event, '⚠️ refresh-jwt erro: ' + e.message);
    return null;
  }
});
