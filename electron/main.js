const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const isDev = !app.isPackaged;
const BiddingRunner = require('./bidding-runner');
const sessionStore = require('./session-store');

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
    },
    backgroundColor: '#020817',
    autoHideMenuBar: true,
  });

  // Initialize Bidding Runner
  biddingRunner = new BiddingRunner(mainWindow.webContents);

  // Decide what to load
  const url = isDev 
    ? 'http://localhost:5173' 
    : 'https://polaryon.com.br';

  mainWindow.loadURL(url);

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

app.whenReady().then(() => {
  createWindow();

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

// IPC Handler for native notifications
ipcMain.on('show-notification', (event, { title, body }) => {
  new Notification({ title, body }).show();
});

// LOCAL BIDDING IPC HANDLERS
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
