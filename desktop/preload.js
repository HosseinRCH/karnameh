const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('karnameh', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (text) => ipcRenderer.send('data:save', text),
  saveFile: (name, content) => ipcRenderer.invoke('file:save', name, content),
  openDataFile: () => ipcRenderer.invoke('file:open'),
  attachFile: () => ipcRenderer.invoke('file:attach'),
  openAttachment: (fileName) => ipcRenderer.invoke('file:open-attachment', fileName),
  deleteAttachmentFile: (fileName) => ipcRenderer.invoke('file:delete-attachment', fileName),
  dataDir: () => ipcRenderer.invoke('app:data-dir'),
  openDataFolder: () => ipcRenderer.invoke('data:open-folder'),
  version: () => ipcRenderer.invoke('app:version'),
  syncConfig: () => ipcRenderer.invoke('sync:config'),
  syncSetConfig: (patch) => ipcRenderer.invoke('sync:set-config', patch),
  syncPick: (mode) => ipcRenderer.invoke('sync:pick', mode),
  syncUnlink: () => ipcRenderer.invoke('sync:unlink'),
  syncRead: () => ipcRenderer.invoke('sync:read'),
  syncWrite: (text) => ipcRenderer.invoke('sync:write', text),
});
