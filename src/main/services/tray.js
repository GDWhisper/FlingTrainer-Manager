// 系统托盘模块
// 懒创建：首次隐藏到托盘时才创建托盘图标，避免未使用该功能的用户常驻图标

import { app, Tray, Menu } from 'electron';
import path from 'path';

let tray = null;
let mainWindow = null;

export function bindMainWindow(win) {
  mainWindow = win;
}

/**
 * 显示并聚焦主窗口（托盘图标点击 / 菜单「显示主窗口」）
 */
export function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function ensureTray() {
  if (tray) return tray;
  try {
    // 与窗口图标同路径：dev 指向仓库根、打包指向 asar 根（build.files 已含 icon.ico）
    tray = new Tray(path.join(__dirname, '../../icon.ico'));
    tray.setToolTip('风灵月影宗');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '显示主窗口', click: showMainWindow },
        { type: 'separator' },
        { label: '退出', click: () => app.quit() },
      ])
    );
    tray.on('click', showMainWindow);
    tray.on('double-click', showMainWindow);
  } catch (err) {
    console.error('创建托盘失败:', err);
    tray = null;
  }
  return tray;
}

/**
 * 隐藏主窗口到托盘；托盘创建失败时退化为普通最小化，避免窗口不可见且无入口
 */
export function hideToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: '主窗口不可用' };
  }
  if (!ensureTray()) {
    mainWindow.minimize();
    return { success: false, error: '创建托盘失败，已最小化到任务栏' };
  }
  mainWindow.hide();
  return { success: true };
}
