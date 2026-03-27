// preload.js - 安全的 API 桥接
// 仅暴露必要的 IPC 接口，不直接暴露 Node.js API

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 游戏相关
  loadGames: (forceRefresh = false) => ipcRenderer.invoke('load-games-from-web', forceRefresh),
  searchGames: (keyword, forceRefresh = false) => ipcRenderer.invoke('search-games', keyword, forceRefresh),

  // 下载相关
  getDownloadInfo: (downloadPageUrl, gameName) =>
    ipcRenderer.invoke('get-download-info', downloadPageUrl, gameName),
  addDownloadTask: (taskInfo) =>
    ipcRenderer.invoke('add-download-task', taskInfo),
  cancelDownloadTask: (taskId) =>
    ipcRenderer.invoke('cancel-download-task', taskId),
  removeDownloadTask: (taskId) =>
    ipcRenderer.invoke('remove-download-task', taskId),
  clearAllDownloadTasks: () =>
    ipcRenderer.invoke('clear-all-download-tasks'),
  getAllDownloadTasks: () =>
    ipcRenderer.invoke('get-all-download-tasks'),
  getDownloadTaskStatus: (taskId) =>
    ipcRenderer.invoke('get-download-task-status', taskId),
  clearFinishedTasks: () =>
    ipcRenderer.invoke('clear-finished-tasks'),
  startDownloadListener: () =>
    ipcRenderer.invoke('start-download-listener'),
  stopDownloadListener: () =>
    ipcRenderer.invoke('stop-download-listener'),
  
  // 监听下载状态变化
  onDownloadStatusChanged: (callback) => {
    ipcRenderer.on('download-status-changed', (_event, data) => callback(data));
  },

  // 设置相关
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),

  // 文件管理
  listDownloadedFiles: (folderPath) =>
    ipcRenderer.invoke('list-downloaded-files', folderPath),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  launchTool: (filePath) => ipcRenderer.invoke('launch-tool', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),

  // 窗口和链接
  openDetailWindow: (url) => ipcRenderer.invoke('open-detail-window', url),
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
});
