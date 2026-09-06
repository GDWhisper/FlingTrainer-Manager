// 窗口和外部链接 IPC 处理器

import { app, ipcMain, shell, BrowserWindow } from 'electron';
import { hideToTray } from '../services/tray.js';

export function registerWindowHandlers() {
  // 打开外部链接
  ipcMain.handle('open-external-link', async (_event, url) => {
    // 只放行 http/https：链接可能来自抓取的网页内容，其他 scheme（file:、自定义协议等）
    // 交给系统处理器执行存在被利用风险
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      console.error('Invalid URL format:', url);
      return { success: false, error: '无效的链接格式' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { success: false, error: '仅支持打开 http/https 链接' };
    }
    try {
      await shell.openExternal(parsed.href);
      return { success: true };
    } catch (error) {
      console.error('Failed to open external link:', error);
      return { success: false, error: error.message };
    }
  });

  // 检查更新：已迁移到 ipc/updater.js 的真实实现

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

  // 隐藏主窗口到系统托盘
  ipcMain.handle('minimize-to-tray', () => {
    return hideToTray();
  });

  // 直接退出应用（关闭弹窗选「直接退出」时走这里；
  // 若再走 close-window 会被未记住的询问逻辑二次拦截）
  ipcMain.handle('quit-app', () => {
    app.quit();
    return { success: true };
  });
}
