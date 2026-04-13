const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (payload) => ipcRenderer.send('show-notification', payload),
  startLocalBidding: (sessionData) => ipcRenderer.send('start-local-bidding', sessionData),
  stopLocalBidding: (sessionId) => ipcRenderer.send('stop-local-bidding', sessionId),
  onBiddingUpdate: (callback) => ipcRenderer.on('bidding-update', (event, data) => callback(data)),
  onBiddingError: (callback) => ipcRenderer.on('bidding-error', (event, data) => callback(data)),
  isDesktop: true
});
