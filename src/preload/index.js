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
  
  // 监听下载状态变化（返回解绑函数，用于注销监听器）
  onDownloadStatusChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download-status-changed', handler);
    return () => ipcRenderer.removeListener('download-status-changed', handler);
  },

  // 设置相关
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  setLaunchAtStartup: (enabled) => ipcRenderer.invoke('set-launch-at-startup', enabled),

  // 文件管理
  listDownloadedFiles: (folderPath) =>
    ipcRenderer.invoke('list-downloaded-files', folderPath),
  launchTool: (filePath) => ipcRenderer.invoke('launch-tool', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),

  // 窗口和链接
  openDetailWindow: (url) => ipcRenderer.invoke('open-detail-window', url),
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),

  // 应用更新
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  pauseUpdateDownload: () => ipcRenderer.invoke('pause-update-download'),
  cancelUpdateDownload: () => ipcRenderer.invoke('cancel-update-download'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  startUpdateListener: () => ipcRenderer.invoke('start-update-listener'),
  stopUpdateListener: () => ipcRenderer.invoke('stop-update-listener'),
  // 监听更新状态变化（返回解绑函数，用于注销监听器）
  onUpdateStateChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update-state-changed', handler);
    return () => ipcRenderer.removeListener('update-state-changed', handler);
  },

  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // 主进程请求询问关闭行为（用户未设置过关闭方式时），返回解绑函数
  onCloseBehaviorConfirmRequested: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('close-behavior-confirm-requested', handler);
    return () => ipcRenderer.removeListener('close-behavior-confirm-requested', handler);
  },
});
