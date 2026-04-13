const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (payload) => ipcRenderer.send('show-notification', payload),
  isDesktop: true
});
