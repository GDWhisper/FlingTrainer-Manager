// 窗口和外部链接 IPC 处理器

import { ipcMain, shell, BrowserWindow } from 'electron';
import path from 'path';

export function registerWindowHandlers() {
  // 打开详情窗口
  ipcMain.handle('open-detail-window', async (_event, url) => {
    const detailWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    detailWindow.loadURL(url);
    return { success: true };
  });

  // 打开外部链接
  ipcMain.handle('open-external-link', async (_event, url) => {
    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      console.error('Invalid URL format:', url);
      return { success: false, error: '无效的链接格式' };
    }
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('Failed to open external link:', error);
      return { success: false, error: error.message };
    }
  });

  // 检查更新
  ipcMain.handle('check-for-updates', async () => {
    return { hasUpdate: false };
  });

  // 最小化窗口
  ipcMain.handle('minimize-window', async () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.minimize();
    }
  });

  // 最大化/还原窗口
  ipcMain.handle('maximize-window', async () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  // 关闭窗口
  ipcMain.handle('close-window', async () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.close();
    }
  });
}
