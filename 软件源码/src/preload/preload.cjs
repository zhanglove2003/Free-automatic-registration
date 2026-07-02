const { contextBridge, ipcRenderer } = require('electron');

const api = {
  snapshot: () => ipcRenderer.invoke('app:snapshot'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('cmd:saveSettings', settings),
  getSmsCountries: () => ipcRenderer.invoke('sms:countries'),
  getCheapestSmsCountries: () => ipcRenderer.invoke('sms:autoCountries'),
  getSmsBalance: () => ipcRenderer.invoke('sms:balance'),
  createJob: (input) => ipcRenderer.invoke('cmd:start', input),
  testSmsPurchase: () => ipcRenderer.invoke('sms:testPurchase'),
  checkNetwork: () => ipcRenderer.invoke('network:check'),
  openBrowserMonitor: (taskId, bounds) => ipcRenderer.invoke('monitor:openBrowser', taskId, bounds),
  closeBrowserMonitor: (taskId) => ipcRenderer.invoke('monitor:closeBrowser', taskId),
  destroyBrowserMonitor: (taskId) => ipcRenderer.invoke('monitor:destroyBrowser', taskId),
  captureBrowser: (taskId) => ipcRenderer.invoke('monitor:captureBrowser', taskId),
  openUtilityBrowser: (sessionId, url, bounds) => ipcRenderer.invoke('utility:openBrowser', sessionId, url, bounds),
  closeUtilityBrowser: (sessionId) => ipcRenderer.invoke('utility:closeBrowser', sessionId),
  attachUtilityBrowser: (sessionId, bounds) => ipcRenderer.invoke('utility:attachBrowser', sessionId, bounds),
  goUtilityBrowserBack: (sessionId) => ipcRenderer.invoke('utility:goBack', sessionId),
  goUtilityBrowserForward: (sessionId) => ipcRenderer.invoke('utility:goForward', sessionId),
  reloadUtilityBrowser: (sessionId) => ipcRenderer.invoke('utility:reload', sessionId),
  setBrowserColorScheme: (scheme) => ipcRenderer.invoke('browser:setColorScheme', scheme),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggleMaximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onSnapshot: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('app:snapshot', listener);
    return () => ipcRenderer.off('app:snapshot', listener);
  },
};

contextBridge.exposeInMainWorld('registrationApp', api);
