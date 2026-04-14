const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (payload) => ipcRenderer.send('show-notification', payload),
  startLocalBidding: (sessionData) => ipcRenderer.send('start-local-bidding', sessionData),
  stopLocalBidding: (sessionId) => ipcRenderer.send('stop-local-bidding', sessionId),
  updateLocalBiddingConfig: (sessionId, config) => ipcRenderer.send('update-local-config', { sessionId, config }),
  onBiddingUpdate: (callback) => ipcRenderer.on('bidding-update', (event, data) => callback(data)),
  onBiddingError: (callback) => ipcRenderer.on('bidding-error', (event, data) => callback(data)),
  isDesktop: true,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, progress) => callback(progress)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, error) => callback(error))
});
