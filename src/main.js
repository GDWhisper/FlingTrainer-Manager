// main.js
process.on("uncaughtException", (error) => {
  console.error("未捕获的异常:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("未处理的 Promise 拒绝:", reason);
});

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { crawlIfUpdated } = require("./crawler.js");
const { searchGames } = require("./searchCrawler.js");
const { getDownloadInfo } = require("./downloadCrawler.js");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const axios = require("axios");
const packageJson = require("../package.json");

// 获取用户数据目录作为缓存根目录
const userDataPath = app.getPath("userData");
const cacheDir = path.join(userDataPath, "cache");

const { Menu } = require("electron");
// 创建一个空菜单
const menu = Menu.buildFromTemplate([]);
Menu.setApplicationMenu(menu);

// 存储所有窗口的引用
let windows = [];

function createWindow() {
  const appVersion = packageJson.version || "0.0.0";
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 加载本地 HTML 文件
  mainWindow.loadFile("src/index.html");
  // 打开开发者工具（调试用）
  // mainWindow.webContents.openDevTools();

  // 动态设置窗口标题
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.setTitle(`风灵月影 v${appVersion}`);
  });

  // 将窗口添加到窗口数组中
  windows.push(mainWindow);

  // 监听窗口关闭事件 - 直接关闭，不隐藏
  mainWindow.on("closed", () => {
    windows = windows.filter((win) => win !== mainWindow);
  });

  return mainWindow;
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

  // 监听窗口关闭事件 - 直接关闭，不隐藏
  detailWindow.on("closed", () => {
    windows = windows.filter((win) => win !== detailWindow);
  });

  return detailWindow;
}

// 当 Electron 完成初始化后，创建窗口
app
  .whenReady()
  .then(() => {
    try {
      const mainWindow = createWindow();

      app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    } catch (error) {
      console.error("创建窗口时出错:", error);
      app.quit();
    }
  })
  .catch((error) => {
    console.error("应用启动失败:", error);
    app.quit();
  });

// 所有窗口关闭时退出应用
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// 当渲染进程请求加载游戏信息时
ipcMain.handle("load-games-from-web", async () => {
  try {
    const result = await crawlIfUpdated();
    return {
      ...result,
      lastCheck: result.lastCheck
        ? new Date(result.lastCheck).toISOString()
        : undefined,
    };
  } catch (err) {
    console.error("IPC handler error:", err);
    return { updated: false, data: [], error: "系统错误: " + err.message };
  }
});

// 搜索游戏
ipcMain.handle("search-games", async (event, keyword) => {
  return await searchGames(keyword);
});

// 获取下载信息
ipcMain.handle(
  "get-download-info",
  async (event, downloadPageUrl, gameName) => {
    const result = await getDownloadInfo(downloadPageUrl);
    // 使用传递过来的游戏名称覆盖下载页面提取的名称
    if (gameName && gameName !== "未知游戏") {
      result.gameName = gameName;
    }
    return result;
  }
);

// 打开详情页窗口
ipcMain.handle("open-detail-window", async (event, url) => {
  createDetailWindow(url);
  return { success: true };
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

    console.log(`开始下载文件: ${url}`);
    console.log(`下载目录: ${folder}`);

    // 使用 axios 下载文件，添加适当的请求头
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Referer: "https://flingtrainer.com/",
      },
      // 跟随重定向
      maxRedirects: 5,
    });

    // 检查响应状态
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 从 Content-Disposition 头中提取文件名
    let fileName = null;
    const contentDisposition = response.headers["content-disposition"];
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (fileNameMatch) {
        fileName = fileNameMatch[1];
      }
    }

    // 如果没有从 header 中获取到文件名，则从 URL 中提取
    if (!fileName) {
      const urlObj = new URL(url);
      fileName = path.basename(urlObj.pathname);
    }

    // 确保有文件扩展名
    if (!path.extname(fileName)) {
      // 根据 Content-Type 设置扩展名
      const contentType = response.headers["content-type"];
      if (contentType) {
        if (contentType.includes("application/x-rar")) {
          fileName += ".rar";
        } else if (contentType.includes("application/zip")) {
          fileName += ".zip";
        } else if (
          contentType.includes("application/x-msdownload") ||
          contentType.includes("application/octet-stream")
        ) {
          fileName += ".exe";
        } else {
          fileName += ".bin"; // 默认扩展名
        }
      } else {
        fileName += ".bin";
      }
    }

    console.log(`文件名: ${fileName}`);

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

    console.log(`保存路径: ${filePath}`);

    // 下载文件
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    // 添加下载进度日志
    let downloadedSize = 0;
    response.data.on("data", (chunk) => {
      downloadedSize += chunk.length;
      console.log(`已下载: ${downloadedSize} 字节`);
    });

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        // 检查文件大小
        const stats = fs.statSync(filePath);
        console.log(`下载完成，文件大小: ${stats.size} 字节`);

        if (stats.size === 0) {
          fs.unlinkSync(filePath); // 删除空文件
          resolve({ success: false, error: "下载的文件为空" });
        } else {
          resolve({ success: true, fileName: path.basename(filePath) });
        }
      });

      writer.on("error", (err) => {
        console.error("写入文件失败:", err);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // 删除损坏的文件
        }
        resolve({ success: false, error: err.message });
      });
    });
  } catch (err) {
    console.error("下载失败:", err);
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

// 已下载页签相关功能
ipcMain.handle("list-downloaded-files", async (event, folderPath) => {
  try {
    // 检查文件夹是否存在
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: "下载文件夹不存在" };
    }

    // 读取文件夹内容
    const files = fs.readdirSync(folderPath);

    // 过滤出 exe 和压缩文件
    const validFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return (
        ext === ".exe" || ext === ".zip" || ext === ".rar" || ext === ".7z"
      );
    });

    // 获取游戏缓存数据，用于匹配图片
    let gameData = [];
    try {
      const cacheDir = path.join(__dirname, "cache");
      const cacheFile = path.join(cacheDir, "games.json");
      if (fs.existsSync(cacheFile)) {
        const cacheContent = fs.readFileSync(cacheFile, "utf-8");
        const cacheData = JSON.parse(cacheContent);
        gameData = cacheData.data || [];
      }
    } catch (cacheErr) {
      console.warn("读取游戏缓存数据失败:", cacheErr.message);
    }

    // 获取文件详细信息
    const fileList = validFiles.map((file) => {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);
      const ext = path.extname(file).toLowerCase();

      // 尝试从文件名匹配游戏图片
      let gameImage = null;
      const fileNameWithoutExt = path.basename(file, path.extname(file));

      // 在游戏数据中查找匹配项
      const matchedGame = gameData.find((game) => {
        if (!game.name) return false;
        // 简单的匹配逻辑：检查文件名是否包含游戏名（忽略大小写和特殊字符）
        const normalizedName = game.name
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
        const normalizedFileName = fileNameWithoutExt
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
        return (
          normalizedFileName.includes(normalizedName) ||
          normalizedName.includes(normalizedFileName)
        );
      });

      if (matchedGame && matchedGame.img) {
        gameImage = matchedGame.img;
      }

      return {
        name: file,
        path: filePath,
        size: stat.size,
        modified: stat.mtime,
        isExecutable: ext === ".exe",
        isCompressed: ext === ".zip" || ext === ".rar" || ext === ".7z",
        image: gameImage || "../pic/default.png",
      };
    });

    return { success: true, files: fileList };
  } catch (err) {
    console.error("读取下载文件夹失败:", err);
    return { success: false, error: err.message };
  }
});
// 监听来自渲染进程的打开外部链接请求
ipcMain.handle("open-external-link", async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error("Failed to open external link:", error);
    return { success: false, error: error.message };
  }
});
