const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const https = require('https');
const fs = require('fs');

// ─── Paths ───────────────────────────────────────────────────────────────────
const isDev = !app.isPackaged;
const appDir = isDev ? __dirname : process.resourcesPath;
const indexPath = path.join(appDir, 'index.js');
const preloadPath = path.join(__dirname, 'preload.js');
const uiPath = path.join(__dirname, 'ui', 'index.html');

const APP_VERSION = '3.0.0';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/index.js';
const MAX_LOG_LINES = 500;
const MAX_RESTART_ATTEMPTS = 5;

// ─── State ───────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let proxyProcess = null;
let isQuitting = false;
let intentionalStop = false;
let currentStatus = 'stopped'; // 'stopped' | 'starting' | 'active' | 'error'
let restartAttempts = 0;
let restartTimer = null;

let logBuffer = [];
let stats = {
  printedToday: 0,
  failedToday: 0,
  startTime: null,
  lastResetDate: new Date().toDateString(),
};

// ─── Single Instance Lock ────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(init);
}

// ─── Tray Icons (programmatic 16x16 PNGs) ────────────────────────────────────
function createTrayIcon(color) {
  // Create a 16x16 image with a colored circle
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4); // RGBA

  const cx = 8, cy = 8, r = 6;
  const colors = {
    green:  [0, 200, 83, 255],
    red:    [244, 67, 54, 255],
    amber:  [255, 193, 7, 255],
  };
  const [cr, cg, cb, ca] = colors[color] || colors.red;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const idx = (y * size + x) * 4;
      if (dist <= r) {
        // Anti-aliased edge
        const alpha = dist > r - 1 ? Math.max(0, (r - dist)) * ca : ca;
        canvas[idx] = cr;
        canvas[idx + 1] = cg;
        canvas[idx + 2] = cb;
        canvas[idx + 3] = Math.round(alpha);
      } else {
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

// ─── Init ────────────────────────────────────────────────────────────────────
async function init() {
  createTray();
  createWindow();
  startProxy();

  // Daily stats reset check every 60 seconds
  setInterval(() => {
    const today = new Date().toDateString();
    if (today !== stats.lastResetDate) {
      stats.printedToday = 0;
      stats.failedToday = 0;
      stats.lastResetDate = today;
      sendToRenderer('stats-update', getStatsPayload());
    }
  }, 60000);
}

// ─── Tray ────────────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(createTrayIcon('red'));
  tray.setToolTip('Le Vantage Print Proxy - Stopped');
  updateTrayMenu();

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  const isRunning = currentStatus === 'active' || currentStatus === 'starting';
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => { mainWindow?.show(); mainWindow?.focus(); }
    },
    { type: 'separator' },
    {
      label: 'Start Proxy',
      enabled: !isRunning,
      click: () => startProxy()
    },
    {
      label: 'Stop Proxy',
      enabled: isRunning,
      click: () => stopProxy()
    },
    {
      label: 'Restart Proxy',
      click: () => restartProxy()
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => autoUpdate()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        stopProxy();
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

function updateTrayIcon(color) {
  if (tray) {
    tray.setImage(createTrayIcon(color));
    const statusText = color === 'green' ? 'Active' : color === 'amber' ? 'Starting...' : 'Stopped';
    tray.setToolTip(`Le Vantage Print Proxy - ${statusText}`);
  }
}

// ─── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 680,
    minWidth: 400,
    minHeight: 500,
    title: 'Le Vantage Print Proxy',
    show: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(uiPath);

  // Close → minimize to tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Remove menu bar
  mainWindow.setMenuBarVisibility(false);
}

// ─── Child Process Management ────────────────────────────────────────────────
function startProxy() {
  if (proxyProcess) return;

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  intentionalStop = false;
  currentStatus = 'starting';
  updateTrayIcon('amber');
  updateTrayMenu();
  sendToRenderer('status-change', { status: 'starting' });

  addLog('info', '[APP] Starting print proxy...');

  // Spawn node index.js
  proxyProcess = spawn('node', [indexPath], {
    cwd: appDir,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Parse stdout line by line
  let stdoutBuffer = '';
  proxyProcess.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop(); // keep incomplete line
    for (const line of lines) {
      if (line.trim()) handleLogLine(line.trim(), 'info');
    }
  });

  // Parse stderr line by line
  let stderrBuffer = '';
  proxyProcess.stderr.on('data', (chunk) => {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split('\n');
    stderrBuffer = lines.pop();
    for (const line of lines) {
      if (line.trim()) handleLogLine(line.trim(), 'error');
    }
  });

  // Handle child exit
  proxyProcess.on('exit', (code, signal) => {
    proxyProcess = null;

    if (intentionalStop) {
      currentStatus = 'stopped';
      updateTrayIcon('red');
      updateTrayMenu();
      sendToRenderer('status-change', { status: 'stopped' });
      addLog('info', '[APP] Proxy stopped.');
      restartAttempts = 0;
    } else {
      // Unexpected crash
      currentStatus = 'error';
      updateTrayIcon('red');
      updateTrayMenu();
      sendToRenderer('status-change', { status: 'error' });
      addLog('error', `[APP] Proxy crashed (code=${code}, signal=${signal}).`);

      restartAttempts++;
      if (restartAttempts <= MAX_RESTART_ATTEMPTS) {
        addLog('info', `[APP] Auto-restarting in 5s (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
        restartTimer = setTimeout(() => startProxy(), 5000);
      } else {
        addLog('error', `[APP] Max restart attempts reached. Please restart manually.`);
      }
    }
  });

  proxyProcess.on('error', (err) => {
    addLog('error', `[APP] Failed to start proxy: ${err.message}`);
    proxyProcess = null;
    currentStatus = 'error';
    updateTrayIcon('red');
    updateTrayMenu();
    sendToRenderer('status-change', { status: 'error' });
  });
}

function stopProxy() {
  return new Promise((resolve) => {
    if (!proxyProcess) {
      currentStatus = 'stopped';
      updateTrayIcon('red');
      updateTrayMenu();
      sendToRenderer('status-change', { status: 'stopped' });
      resolve();
      return;
    }

    intentionalStop = true;
    addLog('info', '[APP] Stopping proxy...');

    const forceKillTimer = setTimeout(() => {
      if (proxyProcess) {
        proxyProcess.kill('SIGKILL');
      }
    }, 3000);

    proxyProcess.once('exit', () => {
      clearTimeout(forceKillTimer);
      resolve();
    });

    proxyProcess.kill('SIGTERM');
  });
}

async function restartProxy() {
  restartAttempts = 0;
  await stopProxy();
  startProxy();
}

// ─── Log Handling ────────────────────────────────────────────────────────────
function handleLogLine(line, level) {
  // Parse structured tags for stats
  if (line.includes('[JOB:printed]')) {
    stats.printedToday++;
    sendToRenderer('stats-update', getStatsPayload());
  } else if (line.includes('[JOB:failed]')) {
    stats.failedToday++;
    sendToRenderer('stats-update', getStatsPayload());
  } else if (line.includes('[PROXY:ready]')) {
    currentStatus = 'active';
    stats.startTime = Date.now();
    restartAttempts = 0;
    updateTrayIcon('green');
    updateTrayMenu();
    sendToRenderer('status-change', { status: 'active' });
  }

  addLog(level, line);
}

function addLog(level, message) {
  const timestamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const entry = { timestamp, level, message };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();

  sendToRenderer('log-line', entry);
}

// ─── Stats ───────────────────────────────────────────────────────────────────
function getUptime() {
  if (!stats.startTime || currentStatus !== 'active') return 0;
  return Math.floor((Date.now() - stats.startTime) / 1000);
}

function getStatsPayload() {
  return {
    printed: stats.printedToday,
    failed: stats.failedToday,
    uptime: getUptime(),
  };
}

// ─── Auto-Update ─────────────────────────────────────────────────────────────
async function autoUpdate() {
  addLog('info', '[UPDATE] Downloading latest index.js from GitHub...');

  try {
    const code = await downloadFile(GITHUB_RAW_URL);

    // Check if code actually changed
    const currentCode = fs.readFileSync(indexPath, 'utf-8');
    if (code.trim() === currentCode.trim()) {
      addLog('info', '[UPDATE] Already up to date.');
      sendToRenderer('update-result', { success: true, message: 'Already up to date!' });
      return;
    }

    const wasRunning = currentStatus === 'active' || currentStatus === 'starting';
    if (wasRunning) {
      addLog('info', '[UPDATE] Stopping proxy for update...');
      await stopProxy();
    }

    fs.writeFileSync(indexPath, code, 'utf-8');
    addLog('info', '[UPDATE] Updated index.js successfully.');
    sendToRenderer('update-result', { success: true, message: 'Updated! Restarting...' });

    if (wasRunning) {
      restartAttempts = 0;
      startProxy();
    }
  } catch (err) {
    addLog('error', `[UPDATE] Failed: ${err.message}`);
    sendToRenderer('update-result', { success: false, message: `Update failed: ${err.message}` });
  }
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.on('proxy-start', () => startProxy());
  ipcMain.on('proxy-stop', () => stopProxy());
  ipcMain.on('proxy-restart', () => restartProxy());
  ipcMain.on('proxy-update', () => autoUpdate());
  ipcMain.on('clear-logs', () => { logBuffer = []; });

  ipcMain.on('set-auto-start', (_, enabled) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
  });

  ipcMain.handle('get-status', () => currentStatus);
  ipcMain.handle('get-stats', () => getStatsPayload());
  ipcMain.handle('get-logs', () => logBuffer);
  ipcMain.handle('get-version', () => APP_VERSION);
  ipcMain.handle('get-auto-start', () => {
    return app.getLoginItemSettings().openAtLogin;
  });
}

setupIPC();

// ─── Renderer Communication ─────────────────────────────────────────────────
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.on('before-quit', () => {
  isQuitting = true;
  if (restartTimer) clearTimeout(restartTimer);
  if (proxyProcess) {
    proxyProcess.kill('SIGTERM');
    // Force kill after 2s
    setTimeout(() => {
      if (proxyProcess) proxyProcess.kill('SIGKILL');
    }, 2000);
  }
});

app.on('window-all-closed', () => {
  // Don't quit — tray keeps the app alive
});
