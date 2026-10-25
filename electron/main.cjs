const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const net = require('net');

// Set environment for Electron
process.env.ELECTRON_MANAGED = 'true';

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
let mainWindow = null;
let serverInstance = null;
let activePort = 3000;

/**
 * Check if a port is open or find an available one
 */
function findFreePort(startPort) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', () => {
      resolve(findFreePort(startPort + 1));
    });
    srv.listen(startPort, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Start or connect to the backend engine server
 */
async function ensureServerRunning() {
  if (isDev) {
    // In dev mode, tsx server.ts runs separately on port 3000
    activePort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    console.log(`[Electron Main] Running in DEV mode targeting http://127.0.0.1:${activePort}`);
    return `http://127.0.0.1:${activePort}`;
  }

  // In production / packaged standalone mode, boot internal server from bundled server.cjs
  try {
    activePort = await findFreePort(3000);
    process.env.PORT = String(activePort);
    process.env.SERVE_STATIC = 'true';
    process.env.NODE_ENV = 'production';

    const serverModulePath = path.resolve(__dirname, '..', 'dist-server', 'server.cjs');
    console.log(`[Electron Main] Loading bundled trading engine from ${serverModulePath} on port ${activePort}...`);

    const { createServer } = require(serverModulePath);
    const result = await createServer(activePort);
    serverInstance = result.server;
    console.log(`[Electron Main] Embedded Engine online on http://127.0.0.1:${activePort}`);
    return `http://127.0.0.1:${activePort}`;
  } catch (err) {
    console.error('[Electron Main] Failed to boot internal server module:', err);
    throw err;
  }
}

/**
 * Create the primary desktop application window
 */
async function createMainWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    title: 'Menuka Terminal - Binance SMC AI Auto-Trading Engine',
    backgroundColor: '#020617',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Remove default menu for a sleek trading terminal experience
  Menu.setApplicationMenu(null);

  // Load the application
  await mainWindow.loadURL(appUrl);

  // Show window smoothly when content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Open external links in default OS browser rather than inside the applet window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --------------------------------------------------------------------
// IPC Window Control Handlers
// --------------------------------------------------------------------
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// --------------------------------------------------------------------
// App Lifecycle
// --------------------------------------------------------------------
app.whenReady().then(async () => {
  try {
    const appUrl = await ensureServerRunning();
    await createMainWindow(appUrl);
  } catch (err) {
    console.error('[Electron App Boot Error]', err);
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const appUrl = `http://127.0.0.1:${activePort}`;
      await createMainWindow(appUrl);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverInstance && typeof serverInstance.close === 'function') {
    console.log('[Electron Main] Closing background trading engine server...');
    serverInstance.close();
  }
});
