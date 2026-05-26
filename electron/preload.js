const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (payload) => ipcRenderer.send('show-notification', payload),
  startLocalBidding: (sessionData) => ipcRenderer.send('start-local-bidding', sessionData),
  stopLocalBidding: (sessionId) => ipcRenderer.send('stop-local-bidding', sessionId),
  startVisualBidding: (sessionData) => ipcRenderer.send('start-visual-bidding', sessionData),
  stopVisualBidding: (sessionId) => ipcRenderer.send('stop-visual-bidding', sessionId),
  updateLocalBiddingConfig: (sessionId, config) => ipcRenderer.send('update-local-config', { sessionId, config }),
  setFocusedSession: (sessionId) => ipcRenderer.send('set-focused-session', sessionId),
  onBiddingUpdate: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('bidding-update', fn);
    return () => { ipcRenderer.off('bidding-update', fn); };
  },
  onBiddingError: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('bidding-error', fn);
    return () => { ipcRenderer.off('bidding-error', fn); };
  },
  onBiddingChat: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('bidding-chat', fn);
    return () => { ipcRenderer.off('bidding-chat', fn); };
  },
  onBiddingHybridDump: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('bidding-hybrid-dump', fn);
    return () => { ipcRenderer.off('bidding-hybrid-dump', fn); };
  },
  onBiddingDetectedRoom: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('bidding-detected-room', fn);
    return () => { ipcRenderer.off('bidding-detected-room', fn); };
  },
  // EQUIPAMENTO DE COMBATE V2.1 (SIGA PREGÃO PARITY)
  saveA1Certificate: (data) => ipcRenderer.invoke('save-a1-certificate', data),
  hasA1Certificate: () => ipcRenderer.invoke('has-a1-certificate'),
  focusVisualBidding: (sessionId) => ipcRenderer.send('visual-focus', sessionId),
  navigateVisualBidding: (sessionId, url) => ipcRenderer.send('visual-navigate', { sessionId, url }),
  onBiddingLoginFinished: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('bidding-login-finished', fn);
    return () => { ipcRenderer.off('bidding-login-finished', fn); };
  },
  onBiddingNetworkTraffic: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('bidding-network-traffic', fn);
    return () => { ipcRenderer.off('bidding-network-traffic', fn); };
  },
  manualBid: (purchaseId, itemId, bidId, value, options) => ipcRenderer.send('manual-bid', { purchaseId, itemId, bidId, value, options }),
  sendPortalData: (data) => ipcRenderer.send('send-portal-data', data),
  onPortalDataUpdate: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('portal-data-update', fn);
    return () => { ipcRenderer.off('portal-data-update', fn); };
  },
  onBiddingRankingUpdate: (callback) => {
    const fn = (event, data) => callback(data);
    ipcRenderer.on('bidding-ranking-update', fn);
    return () => { ipcRenderer.off('bidding-ranking-update', fn); };
  },

  isDesktop: true,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateAvailable: (callback) => {
    const fn = (event, info) => callback(info);
    ipcRenderer.on('update-available', fn);
    return () => { ipcRenderer.off('update-available', fn); };
  },
  onUpdateDownloaded: (callback) => {
    const fn = (event, info) => callback(info);
    ipcRenderer.on('update-downloaded', fn);
    return () => { ipcRenderer.off('update-downloaded', fn); };
  },
  onDownloadProgress: (callback) => {
    const fn = (event, progress) => callback(progress);
    ipcRenderer.on('download-progress', fn);
    return () => { ipcRenderer.off('download-progress', fn); };
  },
  onUpdateError: (callback) => {
    const fn = (event, error) => callback(error);
    ipcRenderer.on('update-error', fn);
    return () => { ipcRenderer.off('update-error', fn); };
  },
  onUpdateLog: (callback) => {
    const fn = (event, msg) => callback(msg);
    ipcRenderer.on('bidding-update-log', fn);
    return () => { ipcRenderer.off('bidding-update-log', fn); };
  },
  getRestoredSessions: () => ipcRenderer.invoke('get-restored-sessions'),
  testRankingCaptcha: (purchaseId, itemId, token) => ipcRenderer.invoke('test-ranking-captcha', { purchaseId, itemId, token })
});
