const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (payload) => ipcRenderer.send('show-notification', payload),
  startLocalBidding: (sessionData) => ipcRenderer.send('start-local-bidding', sessionData),
  stopLocalBidding: (sessionId) => ipcRenderer.send('stop-local-bidding', sessionId),
  startVisualBidding: (sessionData) => ipcRenderer.send('start-visual-bidding', sessionData),
  stopVisualBidding: (sessionId) => ipcRenderer.send('stop-visual-bidding', sessionId),
  updateLocalBiddingConfig: (sessionId, config) => ipcRenderer.send('update-local-config', { sessionId, config }),
  onBiddingUpdate: (callback) => ipcRenderer.on('bidding-update', (event, data) => callback(data)),
  onBiddingError: (callback) => ipcRenderer.on('bidding-error', (event, data) => callback(data)),
  onBiddingChat: (callback) => ipcRenderer.on('bidding-chat', (event, data) => callback(data)),
  onBiddingHybridDump: (callback) => ipcRenderer.on('bidding-hybrid-dump', (event, data) => callback(data)),
  onBiddingDetectedRoom: (callback) => ipcRenderer.on('bidding-detected-room', (event, data) => callback(data)),
  // EQUIPAMENTO DE COMBATE V2.1 (SIGA PREGÃO PARITY)
  saveA1Certificate: (data) => ipcRenderer.invoke('save-a1-certificate', data),
  hasA1Certificate: () => ipcRenderer.invoke('has-a1-certificate'),
  focusVisualBidding: (sessionId) => ipcRenderer.send('visual-focus', sessionId),
  navigateVisualBidding: (sessionId, url) => ipcRenderer.send('visual-navigate', { sessionId, url }),

  isDesktop: true,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, progress) => callback(progress)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, error) => callback(error)),
  getRestoredSessions: () => ipcRenderer.invoke('get-restored-sessions')
});
