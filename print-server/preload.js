const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Commands (fire-and-forget)
  startProxy:   () => ipcRenderer.send('proxy-start'),
  stopProxy:    () => ipcRenderer.send('proxy-stop'),
  restartProxy: () => ipcRenderer.send('proxy-restart'),
  updateProxy:  () => ipcRenderer.send('proxy-update'),
  setAutoStart: (enabled) => ipcRenderer.send('set-auto-start', enabled),
  clearLogs:    () => ipcRenderer.send('clear-logs'),

  // Queries (request-response)
  getStatus:    () => ipcRenderer.invoke('get-status'),
  getStats:     () => ipcRenderer.invoke('get-stats'),
  getLogs:      () => ipcRenderer.invoke('get-logs'),
  getVersion:   () => ipcRenderer.invoke('get-version'),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),

  // Event listeners (main pushes to renderer)
  onLogLine:      (cb) => ipcRenderer.on('log-line', (_, data) => cb(data)),
  onStatusChange: (cb) => ipcRenderer.on('status-change', (_, data) => cb(data)),
  onStatsUpdate:  (cb) => ipcRenderer.on('stats-update', (_, data) => cb(data)),
  onUpdateResult: (cb) => ipcRenderer.on('update-result', (_, data) => cb(data)),
});
