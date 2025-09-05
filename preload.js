// preload.js

const { contextBridge, ipcRenderer, shell } = require('electron');

// 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('api', {
  loadGames: () => ipcRenderer.invoke('load-games-from-web'),
  searchGames: (keyword) => ipcRenderer.invoke('search-games', keyword),
  getDownloadInfo: (downloadPageUrl) => ipcRenderer.invoke('get-download-info', downloadPageUrl),
  openExternal: (url) => shell.openExternal(url),
  openDetailWindow: (url) => ipcRenderer.invoke('open-detail-window', url),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectFolder: () => ipcRenderer.invoke('select-folder')
});

console.log('Preload script loaded'); // 添加日志以便调试