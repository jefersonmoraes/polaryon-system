const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const BiddingRunner = require('./bidding-runner.cjs');

let biddingRunner;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Polaryon - Robô de Lances",
    icon: path.join(__dirname, '../public/favicon.ico'), // Fallback icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#020817', // Match our design
    autoHideMenuBar: true,
  });

  // Initialize Bidding Runner
  biddingRunner = new BiddingRunner(win.webContents);

  // Decide what to load
  const url = isDev 
    ? 'http://localhost:5173' 
    : 'https://polaryon.com.br';

  win.loadURL(url);

  // In Dev, open Developer Tools
  if (isDev) {
    win.webContents.openDevTools();
  }

  // Handle visual "Premium" touches
  win.on('page-title-updated', (e) => e.preventDefault());
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
ipcMain.on('start-local-bidding', async (event, { sessionId, uasg, numero, ano, vault }) => {
  if (biddingRunner) {
    await biddingRunner.start(sessionId, uasg, numero, ano, vault);
  }
});

ipcMain.on('stop-local-bidding', (event, sessionId) => {
  if (biddingRunner) {
    biddingRunner.stop(sessionId);
  }
});
