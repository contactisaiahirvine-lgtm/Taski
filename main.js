const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow;

// Configure auto-launch
function setAutoLaunch(enable) {
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: false
  });
}

function createWindow() {
  // Get the primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Window dimensions - tall and narrow for side panel
  const windowWidth = 400;
  const windowHeight = height - 100; // Leave some margin
  const xPosition = 20; // 20px from left edge
  const yPosition = 50; // 50px from top

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: xPosition,
    y: yPosition,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: true,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: 'Taski - Task Manager'
  });

  mainWindow.loadFile('index.html');

  // Uncomment to open DevTools for debugging
  // mainWindow.webContents.openDevTools();

  // Quit the app when the window is closed
  mainWindow.on('close', () => {
    app.quit();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers for data persistence
ipcMain.handle('store:get', (event, key) => {
  return store.get(key);
});

ipcMain.handle('store:set', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('store:delete', (event, key) => {
  store.delete(key);
  return true;
});

// Handle auto-launch setting
ipcMain.handle('autolaunch:set', (event, enable) => {
  setAutoLaunch(enable);
  store.set('autoLaunch', enable);
  return true;
});

ipcMain.handle('autolaunch:get', () => {
  return store.get('autoLaunch', true); // Default to true
});

app.whenReady().then(() => {
  // Set auto-launch based on stored preference (default: enabled)
  const autoLaunchEnabled = store.get('autoLaunch', true);
  setAutoLaunch(autoLaunchEnabled);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
