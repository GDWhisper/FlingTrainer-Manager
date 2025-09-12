// main.js
process.on("uncaughtException", (error) => {
  console.error("未捕获的异常:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("未处理的 Promise 拒绝:", reason);
});

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const axios = require("axios");
const packageJson = require("../../package.json");

import { crawlIfUpdated } from "./games.js";
import { searchGames } from "./search.js";
import { getDownloadInfo } from "./download.js";

// 资源路径处理
const isDev = process.env.NODE_ENV === "development";
const getResourcesPath = () => {
  if (isDev) {
    return path.join(__dirname, "../renderer");
  } else {
    return path.join(__dirname, "../renderer");
  }
};

function getDefaultImage() {
  if (process.env.NODE_ENV === "development") {
    return "/pic/default.png"; // 开发环境使用 public 目录下的路径
  } else {
    // 生产环境使用相对于应用根目录的路径
    return "./pic/default.png";
  }
}

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
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      sandbox: false,
      // devTools: process.env.NODE_ENV === 'development',
      devTools: false,
    },
  });

  // 加载本地 HTML 文件
  //根据环境加载不同入口
  if (process.env.NODE_ENV === "development") {
    // 开发环境 → 从 Vite dev server 加载
    mainWindow.loadURL("http://localhost:5173");
  } else {
    // 生产环境 → 从打包后的 renderer/index.html 加载
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  // 打开开发者工具（调试用）
  // mainWindow.webContents.openDevTools();

  // 动态设置窗口标题
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.setTitle(`风灵月影宗 v${appVersion}`);
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
      preload: path.join(__dirname, "../preload/index.js"),
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

// 设置文件路径
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

    // 使用 axios 下载文件，添加请求头
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

    // 下载进度日志
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
        image: gameImage || getDefaultImage(),
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
  //  URL 格式验证
  try {
    new URL(url); // 验证 URL 格式
  } catch (error) {
    console.error("Invalid URL format:", url);
    return { success: false, error: "无效的链接格式" };
  }
  
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error("Failed to open external link:", error);
    return { success: false, error: error.message };
  }
});

// 获取默认图片路径的 IPC 处理
ipcMain.handle("get-default-image", async () => {
  return getDefaultImage();
});

// 格式化文件大小的 IPC 处理
ipcMain.handle("format-file-size", async (event, bytes) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
});

// 格式化日期的 IPC 处理
ipcMain.handle("format-date", async (event, date) => {
  return new Date(date).toLocaleString("zh-CN");
});

// 启动工具的 IPC 处理
ipcMain.handle("launch-tool", async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (err) {
    console.error("启动工具失败:", err);
    return { success: false, error: err.message };
  }
});

// 检查更新的 IPC 处理
ipcMain.handle("check-for-updates", async () => {
  // 检查更新逻辑
  return { hasUpdate: false };
});

// 获取首页内容的 IPC 处理
ipcMain.handle("get-welcome-content", async () => {
  return `
    <p class="welcome-text">
      1.本软件仅提供从宗门下载游戏辅助工具的便利服务。<br />
      2.任何要求您付费下载、购买激活码或解锁本软件功能等行为均视为诈骗，切勿相信。<br />
      3.通过任何非官方提供的软件、其他来源下载的程序可能已被篡改，存在严重安全风险。因使用非官方版本导致的任何损失后果自负。 <br />
      4.若您希望支持风灵月影（非本下载工具），请务必访问其官方网站：<a href="https://flingtrainer.com" target="_blank">https://flingtrainer.com</a>
    </p>
  `;
});

// 获取关于页面内容的 IPC 处理
ipcMain.handle("get-about-content", async () => {
  return `
    <div class="about-section">
      <h3>风灵月影宗</h3>

      <div class="disclaimer-section">
        <h4>软件性质</h4>
        <p>
          本软件（风灵月影宗）是一个免费的游戏辅助工具下载程序，其唯一功能是从
          <a href="https://flingtrainer.com" target="_blank">https://flingtrainer.com</a>
          获取并本地管理游戏辅助工具。
        </p>

        <h4>免责声明</h4>

        <div class="disclaimer-item">
          <p class="disclaimer-title"><strong>非官方关联：</strong></p>
          <p>
            本软件由开发者本人独立开发，并非风灵月影(FLiNG
            Trainer)的官方团队、合作伙伴或代理商，也与其无任何隶属关系。
          </p>
          <p>
            用户从任何渠道跳转至风灵月影(FLiNG
            Trainer)官方网站，其页面上的广告、赞助内容、付费服务或任何形式的商业收入，均与本人（本软件开发者）无任何关联。本人不从中获取任何收益，也不对其内容负责。
          </p>
        </div>

        <div class="disclaimer-item">
          <p class="disclaimer-title"><strong>软件责任：</strong></p>
          <p>
            本软件不修改、不破解、不重新分发任何软件文件，不收集任何用户数据。所有下载的文件均来自其官方源或用户指定的镜像。因此，风灵月影(FLiNG
            Trainer)的版权、功能性、安全性以及使用该软件所产生的任何直接或间接问题，均由该软件的原始作者和提供商承担全部责任。
          </p>
        </div>

        <div class="disclaimer-item">
          <p class="disclaimer-title"><strong>用户责任：</strong></p>
          <p>
            用户在使用本软件下载并安装风灵月影(FLiNG
            Trainer)提供的软件前，应自行判断其合规性与安全性，并同意遵守该软件的所有授权条款。
          </p>
          <p>
            如果用户通过任何非官方渠道下载、安装或运行本程序，由此导致的一切后果（包括但不限于：程序被篡改、植入病毒木马、捆绑恶意软件、数据泄露、财产损失等）均须由用户自行承担。
          </p>  
        </div>

        <h4>支持与反馈</h4>
        <ul>
          <p><strong>关于本软件 (风灵月影宗)：</strong><br>
            如果您有关于本软件的问题或建议，请访问：<a href="">Github</a>
          </p>
          <p><strong>关于风灵月影(FLiNG Trainer)：</strong><br>
            如果您希望支持风灵月影，请访问其官方网站： <a href="https://flingtrainer.com" target="_blank">https://flingtrainer.com</a>
          </p>
        </ul>
      </div>
    </div>
  `;
});
