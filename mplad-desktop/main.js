const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const waitOn = require('wait-on');

const NEXT_PORT = 3000;
const NEXT_URL = `http://localhost:${NEXT_PORT}`;

let mainWindow = null;
let nextProcess = null;

// ── Start Next.js server ─────────────────────────────────────────────────────
function startNextServer() {
  const isDev = !app.isPackaged;
  const nextAppPath = isDev
    ? path.join(__dirname, '..', 'mplad-app')
    : path.join(process.resourcesPath, 'mplad-app');

  console.log('[MPLADS] Starting Next.js from:', nextAppPath);

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  nextProcess = spawn(npmCmd, ['run', 'start'], {
    cwd: nextAppPath,
    env: { ...process.env, PORT: String(NEXT_PORT) },
    stdio: 'pipe',
    shell: false,
  });

  nextProcess.stdout.on('data', (data) => {
    console.log('[Next.js]', data.toString());
  });
  nextProcess.stderr.on('data', (data) => {
    console.error('[Next.js ERR]', data.toString());
  });
  nextProcess.on('error', (err) => {
    console.error('[Next.js Process Error]', err);
  });
  nextProcess.on('exit', (code) => {
    console.log('[Next.js] exited with code', code);
  });
}

// ── Kill Next.js server ──────────────────────────────────────────────────────
function stopNextServer() {
  if (nextProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(nextProcess.pid), '/f', '/t']);
      } else {
        nextProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('[MPLADS] Failed to kill Next.js process:', e.message);
    }
    nextProcess = null;
  }
}

// ── Create the main window ───────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'MPLADS Portal — Government of India',
    backgroundColor: '#0A0F1E',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false, // show after content loads
    titleBarStyle: 'default',
  });

  // Show loading screen first
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; background: #0A0F1E; display: flex; flex-direction: column;
               align-items: center; justify-content: center; height: 100vh;
               font-family: -apple-system, 'Inter', sans-serif; color: #F8FAFC; }
        .logo { font-size: 3rem; margin-bottom: 16px; }
        h1 { font-size: 1.6rem; font-weight: 800; background: linear-gradient(to right, #38BDF8, #818CF8);
             -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 8px; }
        p { color: #94A3B8; font-size: 0.9rem; }
        .spinner { width: 36px; height: 36px; border: 3px solid rgba(56,189,248,0.2);
                   border-top-color: #38BDF8; border-radius: 50%;
                   animation: spin 0.8s linear infinite; margin-top: 24px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="logo">🇮🇳</div>
      <h1>MPLADS Portal</h1>
      <p>Ministry of Statistics & Programme Implementation</p>
      <div class="spinner"></div>
      <p style="margin-top:16px">Starting server, please wait…</p>
    </body>
    </html>
  `));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Wait for Next.js to be ready, then navigate
  waitOn({ resources: [NEXT_URL], timeout: 60000, interval: 500 })
    .then(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(NEXT_URL);
      }
    })
    .catch((err) => {
      console.error('[MPLADS] Next.js failed to start:', err.message);
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox(
          'Server Start Failed',
          'The MPLADS Next.js server failed to start.\n\n' +
          'Make sure the mplad-app has been built (npm run build).\n\n' + err.message
        );
      }
    });

  // Open DevTools in dev mode
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(NEXT_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App menu ─────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'MPLADS Portal',
      submenu: [
        { label: 'About MPLADS Portal', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        { label: ' Home Dashboard', accelerator: 'CmdOrCtrl+H', click: () => mainWindow?.loadURL(NEXT_URL + '/') },
        { label: '️ MP Workspace', click: () => mainWindow?.loadURL(NEXT_URL + '/mp') },
        { label: '️ Authority Board', click: () => mainWindow?.loadURL(NEXT_URL + '/authority') },
        { label: ' Officer Dashboard', click: () => mainWindow?.loadURL(NEXT_URL + '/officer') },
        { label: ' AI Monitor', click: () => mainWindow?.loadURL(NEXT_URL + '/monitor') },
        { type: 'separator' },
        { label: ' Public Portal', click: () => mainWindow?.loadURL(NEXT_URL + '/public') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Toggle Full Screen', accelerator: 'F11', role: 'togglefullscreen' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Electron lifecycle ───────────────────────────────────────────────────────
app.whenReady().then(() => {
  startNextServer();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopNextServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopNextServer();
});
