// preload.js

const { contextBridge, ipcRenderer, shell } = require('electron');

// 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('api', {
  loadGames: () => ipcRenderer.invoke('load-games-from-web'),
  searchGames: (keyword) => ipcRenderer.invoke('search-games', keyword),
  getDownloadInfo: (downloadPageUrl, gameName) => ipcRenderer.invoke('get-download-info', downloadPageUrl, gameName),
  openExternal: (url) => shell.openExternal(url),
  openDetailWindow: (url) => ipcRenderer.invoke('open-detail-window', url),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  downloadFile: (url, folder) => ipcRenderer.invoke('download-file', url, folder),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath)
});

console.log('Preload script loaded'); // 添加日志以便调试