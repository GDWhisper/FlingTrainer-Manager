// main.js - 应用入口（仅负责窗口创建和生命周期管理）

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { APP_VERSION } from './constants.js';
import { registerAllIpcHandlers } from './ipc/index.js';

// 隐藏默认菜单栏
Menu.setApplicationMenu(Menu.buildFromTemplate([]));

// 注册所有 IPC 处理器
registerAllIpcHandlers();

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
      createWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    } catch (error) {
      console.error('创建窗口时出错:', error);
      app.quit();
    }
  })
  .catch((error) => {
    console.error('应用启动失败:', error);
    app.quit();
  });

// 所有窗口关闭时退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
