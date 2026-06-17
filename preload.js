const { contextBridge, ipcRenderer } = require('electron');

// Register persistent listeners once at startup — no leak
const listeners = {};
function on(channel, cb) {
  if (!listeners[channel]) {
    listeners[channel] = [];
    ipcRenderer.on(channel, (_, data) => {
      listeners[channel].forEach(fn => fn(data));
    });
  }
  listeners[channel].push(cb);
}

contextBridge.exposeInMainWorld('api', {
  // Incoming from main
  onFileOpened:  (cb) => on('file-opened', cb),
  onFileSaved:   (cb) => on('file-saved', cb),
  onNewTab:      (cb) => on('new-tab', cb),
  onCloseTab:    (cb) => on('close-tab', cb),

  // Outgoing to main
  notifyChanged:   (tabId, name) => ipcRenderer.send('content-changed', { tabId, name }),
  notifyActivated: (tabId, filePath, name) => ipcRenderer.send('tab-activated', { tabId, filePath, name }),
  notifyTabClosed: (tabId) => ipcRenderer.send('tab-closed', { tabId }),
  requestOpen:     () => ipcRenderer.send('request-open'),
  requestSave:     (tabId) => ipcRenderer.send('request-save', { tabId }),
  requestSaveAs:   (tabId) => ipcRenderer.send('request-save-as', { tabId }),
});
