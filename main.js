const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let currentFilePath = null;
let isDirty = false;

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

  // Open DevTools on load errors so we can debug
  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('Failed to load:', code, desc);
    mainWindow.webContents.openDevTools();
  });

  mainWindow.on('close', async (e) => {
    if (isDirty) {
      e.preventDefault();
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        message: 'You have unsaved changes.',
        detail: 'Do you want to save before closing?',
      });
      if (response === 0) { await handleSave(); mainWindow.close(); }
      else if (response === 1) { isDirty = false; mainWindow.close(); }
    }
  });
}

async function handleOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (!canceled && filePaths.length > 0) {
    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    currentFilePath = filePath;
    isDirty = false;
    mainWindow.webContents.send('file-opened', { content, filePath });
    updateTitle();
  }
}

async function handleSave() {
  if (!currentFilePath) return handleSaveAs();
  const content = await mainWindow.webContents.executeJavaScript('window.__getEditorContent()');
  fs.writeFileSync(currentFilePath, content, 'utf-8');
  isDirty = false;
  updateTitle();
}

async function handleSaveAs() {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'All Files', extensions: ['*'] }],
    defaultPath: 'untitled.md',
  });
  if (!canceled && filePath) {
    const content = await mainWindow.webContents.executeJavaScript('window.__getEditorContent()');
    fs.writeFileSync(filePath, content, 'utf-8');
    currentFilePath = filePath;
    isDirty = false;
    updateTitle();
  }
}

function handleNew() {
  currentFilePath = null;
  isDirty = false;
  mainWindow.webContents.send('file-opened', { content: '', filePath: null });
  updateTitle();
}

function updateTitle() {
  const name = currentFilePath ? path.basename(currentFilePath) : 'Untitled';
  mainWindow.setTitle(`${name}${isDirty ? ' •' : ''} — QuickQuill`);
}

ipcMain.on('content-changed', () => { isDirty = true; updateTitle(); });
ipcMain.on('request-open', handleOpen);
ipcMain.on('request-save', handleSave);
ipcMain.on('request-save-as', handleSaveAs);
ipcMain.on('request-new', handleNew);

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
        { label: 'New Tab', accelerator: 'CmdOrCtrl+N', click: handleNew },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: handleOpen },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: handleSave },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: handleSaveAs },
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
