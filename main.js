const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Per-tab file state — keyed by tab id from renderer
const tabState = {};  // { [tabId]: { filePath, dirty } }
let activeTabId = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#1e1e1e',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('Failed to load:', code, desc);
  });

  mainWindow.on('close', async (e) => {
    // Skip save dialog in test mode
    if (process.argv.includes('--test-mode') || process.env.QQ_TEST) return;
    // Check all dirty tabs
    const dirtyTabs = Object.entries(tabState).filter(([, s]) => s.dirty);
    if (dirtyTabs.length > 0) {
      e.preventDefault();
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Save All', "Don't Save", 'Cancel'],
        defaultId: 0,
        message: `You have ${dirtyTabs.length} unsaved tab${dirtyTabs.length > 1 ? 's' : ''}.`,
        detail: 'Do you want to save before closing?',
      });
      if (response === 0) {
        for (const [tabId] of dirtyTabs) {
          await handleSaveTab(parseInt(tabId));
        }
        mainWindow.close();
      } else if (response === 1) {
        Object.values(tabState).forEach(s => s.dirty = false);
        mainWindow.close();
      }
    }
  });
}

// IPC: renderer notifies active tab changed
ipcMain.on('tab-activated', (_, { tabId, filePath, name }) => {
  activeTabId = tabId;
  if (!tabState[tabId]) tabState[tabId] = { filePath: filePath || null, dirty: false };
  updateTitle(name, tabState[tabId].dirty);
});

// IPC: renderer notifies content changed for a tab
ipcMain.on('content-changed', (_, { tabId, name }) => {
  if (!tabState[tabId]) tabState[tabId] = { filePath: null, dirty: false };
  tabState[tabId].dirty = true;
  if (tabId === activeTabId) updateTitle(name, true);
});

// IPC: renderer notifies a tab was closed
ipcMain.on('tab-closed', (_, { tabId }) => {
  delete tabState[tabId];
});

// IPC: open file
ipcMain.on('request-open', handleOpen);

// IPC: save active tab
ipcMain.on('request-save', async (_, opts) => {
  const tabId = (opts && opts.tabId) || activeTabId;
  await handleSaveTab(tabId);
});

// IPC: save as active tab
ipcMain.on('request-save-as', async (_, opts) => {
  const tabId = (opts && opts.tabId) || activeTabId;
  await handleSaveAsTab(tabId);
});

async function handleOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Text Files', extensions: ['md', 'markdown', 'txt', 'js', 'ts', 'py', 'json', 'css', 'html', 'yaml', 'yml', 'sh'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (!canceled && filePaths.length > 0) {
    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    mainWindow.webContents.send('file-opened', { content, filePath });
  }
}

async function handleSaveTab(tabId) {
  if (!tabId) return;
  const state = tabState[tabId];
  if (!state || !state.filePath) {
    await handleSaveAsTab(tabId);
    return;
  }
  const content = await mainWindow.webContents.executeJavaScript(
    `window.__getTabContent(${tabId})`
  );
  fs.writeFileSync(state.filePath, content, 'utf-8');
  state.dirty = false;
  const name = path.basename(state.filePath);
  mainWindow.webContents.send('file-saved', { tabId, filePath: state.filePath });
  if (tabId === activeTabId) updateTitle(name, false);
}

async function handleSaveAsTab(tabId) {
  if (!tabId) return;
  const state = tabState[tabId] || { filePath: null };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'All Files', extensions: ['*'] }],
    defaultPath: state.filePath || 'untitled.md',
  });
  if (!canceled && filePath) {
    const content = await mainWindow.webContents.executeJavaScript(
      `window.__getTabContent(${tabId})`
    );
    fs.writeFileSync(filePath, content, 'utf-8');
    if (!tabState[tabId]) tabState[tabId] = {};
    tabState[tabId].filePath = filePath;
    tabState[tabId].dirty = false;
    const name = path.basename(filePath);
    mainWindow.webContents.send('file-saved', { tabId, filePath });
    if (tabId === activeTabId) updateTitle(name, false);
  }
}

function updateTitle(name, dirty) {
  if (!mainWindow) return;
  const displayName = name || 'Untitled';
  mainWindow.setTitle(`${displayName}${dirty ? ' •' : ''} — QuickQuill`);
}

function buildMenu() {
  const template = [
    {
      label: 'QuickQuill',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('new-tab') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: handleOpen },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => handleSaveTab(activeTabId) },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => handleSaveAsTab(activeTabId) },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => mainWindow.webContents.send('close-tab') },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' }, { role: 'zoom' }, { role: 'close' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createWindow();
  buildMenu();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
