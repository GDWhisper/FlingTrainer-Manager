// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('api', {
  loadGames: () => ipcRenderer.invoke('load-games-from-web'),
  searchGames: (keyword) => ipcRenderer.invoke('search-games', keyword),
  getDownloadInfo: (downloadPageUrl) => ipcRenderer.invoke('get-download-info', downloadPageUrl)
});