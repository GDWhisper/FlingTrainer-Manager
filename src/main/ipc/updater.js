// 应用内更新 IPC 处理器

import { app, ipcMain } from 'electron';
import { updateService } from '../services/updater.js';
import { loadSettingsSync } from './settings.js';

// 每次发起网络动作前按最新设置应用更新代理（设置改动即时生效，无需重启）
function applyProxyFromSettings() {
  const applied = updateService.setProxy(loadSettingsSync().updateProxy || '');
  if (!applied.success) {
    console.warn('更新代理配置无效，已回退直连:', applied.error);
  }
}

export function registerUpdaterHandlers() {
  // 检查更新（真实实现，替换原 window.js 占位）
  // 开发环境直接返回，避免开发期对生产清单误报
  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
      return { success: true, devMode: true, update: updateService.getSnapshot() };
    }
    applyProxyFromSettings();
    try {
      const update = await updateService.check();
      return { success: true, update };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取当前更新状态快照（渲染进程初始化时回放）
  ipcMain.handle('get-update-state', async () => {
    return { success: true, update: updateService.getSnapshot() };
  });

  // 开始/继续下载（available、paused、error 均可调用，自动断点续传）
  ipcMain.handle('download-update', async () => {
    applyProxyFromSettings();
    return updateService.startDownload();
  });

  // 暂停下载（保留 .part，可继续）
  ipcMain.handle('pause-update-download', async () => {
    return updateService.pauseDownload();
  });

  // 停止下载（删除 .part，回到可下载态）
  ipcMain.handle('cancel-update-download', async () => {
    return updateService.cancelDownload();
  });

  // 立即安装（静默 /S 安装并退出应用）
  ipcMain.handle('install-update', async () => {
    return updateService.startInstall();
  });

  // 状态推送（三重防护，与 download.js 同构）：
  // ① 渲染进程 beforeunload 调 stop-update-listener
  // ② preload 的 onUpdateStateChanged 返回解绑函数
  // ③ 每次转发前检查 sender.isDestroyed() 并自清理
  let unsubscribeState = null;

  ipcMain.handle('start-update-listener', (event) => {
    // 单主窗口场景，与 download.js 一致只保留最后一个订阅者
    if (unsubscribeState) unsubscribeState();

    const sender = event.sender;
    unsubscribeState = updateService.onStateChanged((snapshot) => {
      if (sender.isDestroyed()) {
        if (unsubscribeState) {
          unsubscribeState();
          unsubscribeState = null;
        }
        return;
      }
      sender.send('update-state-changed', snapshot);
    });

    return { success: true };
  });

  ipcMain.handle('stop-update-listener', async () => {
    if (unsubscribeState) {
      unsubscribeState();
      unsubscribeState = null;
    }
    return { success: true };
  });
}
