const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer (web app)
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  isElectron: true,

  // Version info
  getVersion: () => ipcRenderer.invoke('get-version'),
});
