// main.js - 应用入口（仅负责窗口创建和生命周期管理）

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { APP_VERSION, UPDATE_CONFIG } from './constants.js';
import { registerAllIpcHandlers } from './ipc/index.js';
import { loadSettingsSync } from './ipc/settings.js';
import { updateService } from './services/updater.js';
import { bindMainWindow, hideToTray } from './services/tray.js';
import { repairAutoStart } from './services/autostart.js';

// 隐藏默认菜单栏
Menu.setApplicationMenu(Menu.buildFromTemplate([]));

// 注册所有 IPC 处理器
registerAllIpcHandlers();

let mainWindow = null;
// app.quit()（托盘菜单退出、更新安装、渲染进程 quit-app）时置位，关闭拦截一律放行
let isQuitting = false;

// 创建主窗口
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: path.join(__dirname, '../../icon.ico'), // 设置窗口图标
    frame: false, // 无边框模式
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      sandbox: false,
      devTools: false,
    },
  });

  // 根据环境加载不同入口
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

// 应用启动
app
  .whenReady()
  .then(() => {
    try {
      mainWindow = createWindow();
      bindMainWindow(mainWindow);

      // 关闭拦截：统一处理标题栏 ✕（close-window）与 Alt+F4
      mainWindow.on('close', (event) => {
        if (isQuitting) return;
        const wc = mainWindow.webContents;
        // 页面尚未加载完成时无法弹窗询问，直接放行避免卡死
        if (wc.isLoading()) return;
        const { minimizeToTray } = loadSettingsSync();
        if (minimizeToTray === true) {
          event.preventDefault();
          hideToTray();
        } else if (minimizeToTray === undefined) {
          // 用户未设置过：交由渲染进程弹窗询问
          event.preventDefault();
          if (!wc.isDestroyed()) wc.send('close-behavior-confirm-requested');
        }
        // minimizeToTray === false：放行，正常关闭退出
      });

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });

      // 开机自启自愈：登录项路径失效（便携版挪目录）时重写，见 services/autostart.js
      repairAutoStart(loadSettingsSync());

      // 启动静默检查更新：仅打包版且用户未关闭开关；绝不自动下载，
      // 检查结果经 update-state-changed 推送与设置页快照回放呈现
      setTimeout(() => {
        try {
          if (!app.isPackaged) return;
          const settings = loadSettingsSync();
          if (settings.autoCheckUpdate === false) return;
          updateService.check().catch(() => {
            /* 静默检查失败不打扰用户，状态保留在 updateService 供查询 */
          });
        } catch (err) {
          console.error('启动检查更新失败:', err);
        }
      }, UPDATE_CONFIG.STARTUP_CHECK_DELAY);
    } catch (error) {
      console.error('创建窗口时出错:', error);
      app.quit();
    }
  })
  .catch((error) => {
    console.error('应用启动失败:', error);
    app.quit();
  });

// 任何 app.quit() 路径（托盘菜单退出、更新安装、渲染进程 quit-app）都先经此放行关闭拦截
app.on('before-quit', () => {
  isQuitting = true;
});

// 所有窗口关闭时退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
