const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getInitialState: () => ipcRenderer.invoke('get-initial-state'),
  setConfig: (config) => ipcRenderer.send('set-config', config),
  startSession: () => ipcRenderer.send('start-session'),
  pauseSession: () => ipcRenderer.send('pause-session'),
  resetSession: () => ipcRenderer.send('reset-session'),
  setConnectionMode: (mode) => ipcRenderer.send('set-connection-mode', mode),
  triggerManualLock: () => ipcRenderer.send('trigger-manual-lock'),
  triggerManualUnlock: () => ipcRenderer.send('trigger-manual-unlock')
});
