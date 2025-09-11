// preload.js

const { contextBridge, ipcRenderer, shell } = require("electron");

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld("api", {
  loadGames: () => ipcRenderer.invoke("load-games-from-web"),
  searchGames: (keyword) => ipcRenderer.invoke("search-games", keyword),
  getDownloadInfo: (downloadPageUrl, gameName) =>
    ipcRenderer.invoke("get-download-info", downloadPageUrl, gameName),
  openExternal: (url) => shell.openExternal(url),
  openDetailWindow: (url) => ipcRenderer.invoke("open-detail-window", url),
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  downloadFile: (url, folder) =>
    ipcRenderer.invoke("download-file", url, folder),
  openFolder: (folderPath) => ipcRenderer.invoke("open-folder", folderPath),
  listDownloadedFiles: (folderPath) =>
    ipcRenderer.invoke("list-downloaded-files", folderPath),
  openExternalLink: (url) => ipcRenderer.invoke("open-external-link", url),
  // 新增的安全 API
  getDefaultImage: () => ipcRenderer.invoke("get-default-image"),
  formatFileSize: (bytes) => ipcRenderer.invoke("format-file-size", bytes),
  formatDate: (date) => ipcRenderer.invoke("format-date", date),
  launchTool: (filePath) => ipcRenderer.invoke("launch-tool", filePath),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  // 内容获取 API
  getWelcomeContent: () => ipcRenderer.invoke("get-welcome-content"),
  getAboutContent: () => ipcRenderer.invoke("get-about-content"),
});

console.log("Preload script loaded"); // 添加日志以便调试
