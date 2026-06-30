const { contextBridge, ipcRenderer } = require('electron');

const api = {
  snapshot: () => ipcRenderer.invoke('app:snapshot'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('cmd:saveSettings', settings),
  createJob: (input) => ipcRenderer.invoke('cmd:start', input),
  checkNetwork: () => ipcRenderer.invoke('network:check'),
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
