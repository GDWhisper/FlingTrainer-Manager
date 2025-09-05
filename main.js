// main.js

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { crawlIfUpdated } = require("./crawler");
const { searchGames } = require("./searchCrawler.js");
const { getDownloadInfo } = require("./downloadCrawler.js");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { URL } = require("url");

const { Menu } = require("electron");
// 创建一个空菜单
const menu = Menu.buildFromTemplate([]);
Menu.setApplicationMenu(menu);

// 存储所有窗口的引用
let windows = [];

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
  mainWindow.webContents.openDevTools();

  // 将窗口添加到窗口数组中
  windows.push(mainWindow);

  // 监听窗口关闭事件，从数组中移除
  mainWindow.on("closed", () => {
    windows = windows.filter((win) => win !== mainWindow);
  });
}

// 创建详情页窗口
function createDetailWindow(url) {
  const detailWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 在新窗口中打开指定URL
  detailWindow.loadURL(url);

  // 打开开发者工具（调试用）
  // detailWindow.webContents.openDevTools();

  // 将窗口添加到窗口数组中
  windows.push(detailWindow);

  // 监听窗口关闭事件，从数组中移除
  detailWindow.on("closed", () => {
    windows = windows.filter((win) => win !== detailWindow);
  });

  return detailWindow;
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
ipcMain.handle("get-download-info", async (event, downloadPageUrl, gameName) => {
  const result = await getDownloadInfo(downloadPageUrl);
  // 使用传递过来的游戏名称覆盖下载页面提取的名称
  if (gameName && gameName !== "未知游戏") {
    result.gameName = gameName;
  }
  return result;
});

// 打开详情页窗口
ipcMain.handle("open-detail-window", async (event, url) => {
  createDetailWindow(url);
  return { success: true };
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// 添加设置文件路径
const settingsFile = path.join(app.getPath("userData"), "settings.json");

// 加载设置
ipcMain.handle("load-settings", async () => {
  try {
    if (fs.existsSync(settingsFile)) {
      const settingsData = fs.readFileSync(settingsFile, "utf8");
      return JSON.parse(settingsData);
    }
    return {};
  } catch (err) {
    console.error("加载设置失败:", err);
    return {};
  }
});

// 保存设置
ipcMain.handle("save-settings", async (event, settings) => {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (err) {
    console.error("保存设置失败:", err);
    return { success: false, error: err.message };
  }
});

// 选择文件夹
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// 文件下载功能
ipcMain.handle("download-file", async (event, url, folder) => {
  try {
    // 确保下载目录存在
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    // 从URL中提取文件名
    const urlObj = new URL(url);
    let fileName = path.basename(urlObj.pathname);

    // 如果没有文件扩展名，尝试添加.zip
    if (!path.extname(fileName)) {
      fileName += ".zip";
    }

    // 处理文件名冲突
    let filePath = path.join(folder, fileName);
    let counter = 1;
    const nameWithoutExt = path.basename(fileName, path.extname(fileName));
    const ext = path.extname(fileName);

    while (fs.existsSync(filePath)) {
      const newName = `${nameWithoutExt}(${counter})${ext}`;
      filePath = path.join(folder, newName);
      counter++;
    }

    // 下载文件
    const fileStream = fs.createWriteStream(filePath);

    return new Promise((resolve) => {
      const protocol = url.startsWith("https") ? https : http;

      const request = protocol.get(url, (response) => {
        response.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close();
          resolve({ success: true, fileName: path.basename(filePath) });
        });
      });

      request.on("error", (err) => {
        fileStream.close();
        fs.unlink(filePath, () => {}); // 删除未完成的文件
        resolve({ success: false, error: err.message });
      });

      request.setTimeout(30000, () => {
        request.abort();
        fileStream.close();
        fs.unlink(filePath, () => {});
        resolve({ success: false, error: "下载超时" });
      });
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 添加打开文件夹功能
ipcMain.handle("open-folder", async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (err) {
    console.error("打开文件夹失败:", err);
    return { success: false, error: err.message };
  }
});