// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const { crawlIfUpdated } = require("./crawler");
const { searchGames } = require("./searchCrawler.js");
const { getDownloadInfo } = require("./downloadCrawler.js");
const path = require("path");
const fs = require("fs");

const { Menu } = require("electron");
// 创建一个空菜单
const menu = Menu.buildFromTemplate([]);
Menu.setApplicationMenu(menu);
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // 启用预加载脚本
      nodeIntegration: false,
      contextIsolation: true, // 上下文隔离
    },
  });
  // 加载本地 HTML 文件
  mainWindow.loadFile("index.html");
  // 打开开发者工具（调试用）
  //   mainWindow.webContents.openDevTools();
}

// 当 Electron 完成初始化后，创建窗口
app.whenReady().then(() => {
  createWindow();
  // macOS 点击 dock 图标重新打开窗口
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
// 当渲染进程请求加载游戏信息时
ipcMain.handle("load-games-from-web", async () => {
  try {
    const result = await crawlIfUpdated();
    // 确保 result 中没有不可序列化的对象
    return {
      ...result,
      // 如果 result 包含 Date，转为字符串
      lastCheck: result.lastCheck
        ? new Date(result.lastCheck).toISOString()
        : undefined,
    };
  } catch (err) {
    console.error("IPC handler error:", err); // 添加日志
    return { updated: false, data: [], error: "系统错误: " + err.message };
  }
});
// 搜索游戏
ipcMain.handle("search-games", async (event, keyword) => {
  return await searchGames(keyword);
});

// 获取下载信息
ipcMain.handle("get-download-info", async (event, downloadPageUrl) => {
  return await getDownloadInfo(downloadPageUrl);
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});