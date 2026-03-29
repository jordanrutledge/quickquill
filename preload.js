const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onFileOpened: (callback) => ipcRenderer.on('file-opened', (_, data) => callback(data)),
  notifyChanged: () => ipcRenderer.send('content-changed'),
  requestNew: () => ipcRenderer.send('request-new'),
  requestOpen: () => ipcRenderer.send('request-open'),
  requestSave: () => ipcRenderer.send('request-save'),
  requestSaveAs: () => ipcRenderer.send('request-save-as'),
});
