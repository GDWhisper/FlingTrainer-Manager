"use strict";
const { app: app$3 } = require("electron");
const axios$3 = require("axios");
const cheerio$2 = require("cheerio");
const fs$3 = require("fs");
const path$3 = require("path");
const TARGET_URL = "https://flingtrainer.com";
let CACHE_DIR$2;
let CACHE_FILE;
function initCacheDir$1() {
  if (!CACHE_DIR$2) {
    CACHE_DIR$2 = path$3.join(app$3.getPath("userData"), "cache");
    if (!fs$3.existsSync(CACHE_DIR$2)) fs$3.mkdirSync(CACHE_DIR$2);
    CACHE_FILE = path$3.join(CACHE_DIR$2, "games-cache.json");
  }
  return { CACHE_DIR: CACHE_DIR$2, CACHE_FILE };
}
const LOCK_TIME = 30 * 60 * 1e3;
function readCache$2() {
  if (fs$3.existsSync(CACHE_FILE)) {
    try {
      const data = JSON.parse(fs$3.readFileSync(CACHE_FILE, "utf-8"));
      if (Date.now() - data.timestamp < LOCK_TIME) {
        return data.data;
      }
    } catch (e) {
      console.warn("缓存读取失败:", e.message);
    }
  }
  return null;
}
function writeCache$2(games) {
  fs$3.writeFileSync(
    CACHE_FILE,
    JSON.stringify(
      {
        data: games,
        timestamp: Date.now()
      },
      null,
      2
    ),
    "utf-8"
  );
}
async function fetchGames() {
  initCacheDir$1();
  const cache = readCache$2();
  if (cache) {
    console.log("使用缓存数据");
    return { updated: false, data: cache, fromCache: true };
  }
  console.log("正在获取首页数据...");
  try {
    const response = await axios$3.get(TARGET_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Referer: "https://www.google.com/"
      },
      timeout: 3e4
    });
    const $ = cheerio$2.load(response.data);
    const $items = $(".post-standard");
    console.log(`找到 ${$items.length} 个游戏条目`);
    const games = [];
    $items.each((i, el) => {
      const $el = $(el);
      const name = $el.find(".post-content .post-title a").text().trim();
      const img = $el.find(".post-details .post-details-thumb img").attr("src") || $el.find(".post-details .post-details-thumb img").attr("data-lazy-src") || null;
      const downloadPageLink = $el.find(".post-content .post-title a").attr("href");
      if (name && downloadPageLink) {
        games.push({ name, img, downloadPageLink });
      }
    });
    console.log(`成功提取 ${games.length} 个游戏`);
    if (games.length > 0) {
      writeCache$2(games);
      return { updated: true, data: games, fromCache: false };
    } else {
      return { error: "未找到游戏数据", data: [] };
    }
  } catch (err) {
    console.error("获取失败:", err.message);
    const cache2 = readCache$2();
    if (cache2) {
      return {
        updated: false,
        data: cache2,
        fromCache: true,
        error: "网络错误，使用缓存"
      };
    }
    return { error: "网络错误且无缓存", data: [] };
  }
}
async function crawlIfUpdated() {
  try {
    const result = await fetchGames();
    return result;
  } catch (err) {
    console.error("crawlIfUpdated 执行出错:", err);
    return { error: "系统错误: " + err.message, data: [] };
  }
}
const { app: app$2 } = require("electron");
const axios$2 = require("axios");
const cheerio$1 = require("cheerio");
const fs$2 = require("fs");
const path$2 = require("path");
let CACHE_DIR$1;
function initCacheDir() {
  if (!CACHE_DIR$1) {
    CACHE_DIR$1 = path$2.join(app$2.getPath("userData"), "cache", "search-cache");
    if (!fs$2.existsSync(CACHE_DIR$1)) fs$2.mkdirSync(CACHE_DIR$1, { recursive: true });
  }
  return CACHE_DIR$1;
}
const CACHE_TTL$1 = 30 * 60 * 1e3;
function getCachePath$1(keyword) {
  const CACHE_DIR2 = initCacheDir();
  const sanitized = keyword.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_");
  return path$2.join(CACHE_DIR2, `${sanitized}.json`);
}
function readCache$1(keyword) {
  initCacheDir();
  const cachePath = getCachePath$1(keyword);
  if (fs$2.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs$2.readFileSync(cachePath, "utf-8"));
      if (Date.now() - data.timestamp < CACHE_TTL$1) {
        console.log(`使用缓存数据：${keyword}`);
        return data.games;
      }
    } catch (e) {
      console.warn("缓存读取失败:", e.message);
    }
  }
  return null;
}
function writeCache$1(keyword, games) {
  initCacheDir();
  const cachePath = getCachePath$1(keyword);
  fs$2.writeFileSync(
    cachePath,
    JSON.stringify({ games, timestamp: Date.now() }, null, 2),
    "utf-8"
  );
}
async function searchGames(keyword) {
  initCacheDir();
  if (!keyword || typeof keyword !== "string") {
    return { error: "无效的搜索关键词", data: [] };
  }
  const cached = readCache$1(keyword);
  if (cached) {
    return { updated: false, data: cached, fromCache: true };
  }
  const SEARCH_URL = `https://flingtrainer.com/?s=${encodeURIComponent(
    keyword
  )}`;
  try {
    console.log(`正在搜索：${keyword}`);
    console.log(`访问：${SEARCH_URL}`);
    const response = await axios$2.get(SEARCH_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Referer: "https://www.google.com/"
      },
      timeout: 3e4
    });
    const $ = cheerio$1.load(response.data);
    const $items = $(".post-standard");
    const games = [];
    $items.each((i, el) => {
      const $el = $(el);
      const name = $el.find(".post-content .post-title a").text().trim();
      const img = $el.find(".post-details .post-details-thumb img").attr("src") || $el.find(".post-details .post-details-thumb img").attr("data-lazy-src") || null;
      const downloadPageLink = $el.find(".post-content .post-title a").attr("href");
      if (name && downloadPageLink) {
        games.push({ name, img, downloadPageLink });
      }
    });
    console.log(`成功提取 ${games.length} 个游戏`);
    if (games.length > 0) {
      writeCache$1(keyword, games);
      return { updated: true, data: games, fromCache: false };
    } else {
      return { error: "未找到相关游戏", data: [] };
    }
  } catch (err) {
    console.error("搜索失败:", err.message);
    const cached2 = readCache$1(keyword);
    if (cached2) {
      return {
        updated: false,
        data: cached2,
        fromCache: true,
        error: "网络错误，使用缓存"
      };
    }
    return { error: "搜索失败，请检查网络", data: [] };
  }
}
const { app: app$1 } = require("electron");
const axios$1 = require("axios");
const cheerio = require("cheerio");
const fs$1 = require("fs");
const path$1 = require("path");
let CACHE_DIR;
let DOWNLOAD_CACHE_DIR;
function initCacheDirs() {
  if (!CACHE_DIR) {
    CACHE_DIR = path$1.join(app$1.getPath("userData"), "cache");
    if (!fs$1.existsSync(CACHE_DIR)) fs$1.mkdirSync(CACHE_DIR);
    DOWNLOAD_CACHE_DIR = path$1.join(CACHE_DIR, "download-cache");
    if (!fs$1.existsSync(DOWNLOAD_CACHE_DIR)) fs$1.mkdirSync(DOWNLOAD_CACHE_DIR, { recursive: true });
  }
  return { CACHE_DIR, DOWNLOAD_CACHE_DIR };
}
const CACHE_TTL = 10 * 60 * 1e3;
function getCachePath(url) {
  initCacheDirs();
  const urlHash = require("crypto").createHash("md5").update(url).digest("hex");
  return path$1.join(DOWNLOAD_CACHE_DIR, `${urlHash}.json`);
}
function readCache(url) {
  initCacheDirs();
  const cachePath = getCachePath(url);
  if (fs$1.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs$1.readFileSync(cachePath, "utf-8"));
      if (Date.now() - data.timestamp < CACHE_TTL) {
        console.log(`使用下载页面缓存数据：${url}`);
        return data.downloadInfo;
      }
    } catch (e) {
      console.warn("下载缓存读取失败:", e.message);
    }
  }
  return null;
}
function writeCache(url, downloadInfo) {
  initCacheDirs();
  const cachePath = getCachePath(url);
  fs$1.writeFileSync(
    cachePath,
    JSON.stringify({ downloadInfo, timestamp: Date.now() }, null, 2),
    "utf-8"
  );
}
async function getDownloadInfo(downloadPageUrl) {
  initCacheDirs();
  if (!downloadPageUrl || typeof downloadPageUrl !== "string") {
    return { error: "无效的下载页面链接" };
  }
  const cached = readCache(downloadPageUrl);
  if (cached) {
    return { ...cached, fromCache: true };
  }
  try {
    console.log(`正在访问下载页面：${downloadPageUrl}`);
    const response = await axios$1.get(downloadPageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": "https://flingtrainer.com/"
      },
      timeout: 1e4
      // 10秒超时
    });
    const html = response.data;
    const $ = cheerio.load(html);
    const gameName = $(".post-title h1").first().text().trim() || $(".post-title h2").first().text().trim() || $("title").text().split(" - ")[0].trim() || "未知游戏";
    let downloadLink = null;
    let downloadPassword = null;
    const $attachmentsTable = $(".da-attachments-table");
    if ($attachmentsTable.length > 0) {
      const $zipRows = $attachmentsTable.find(
        "tr[class='zip alt'], tr[class='zip']"
      );
      for (let i = 0; i < $zipRows.length; i++) {
        const $row = $($zipRows[i]);
        const $attachmentTitle = $row.find(".attachment-title");
        if ($attachmentTitle.length > 0) {
          const $link = $attachmentTitle.find("a.attachment-link");
          if ($link.length > 0) {
            const href = $link.attr("href");
            if (href && href.includes("downloads")) {
              downloadLink = href;
              break;
            }
          }
        }
      }
    }
    if (!downloadLink) {
      $(".entry-content a").each((i, el) => {
        const $el = $(el);
        const href = $el.attr("href");
        const text = $el.text().toLowerCase();
        if (href && !href.includes("download.php") && (href.includes("download") || href.includes("attachment") || text.includes("download") || text.includes("下载"))) {
          downloadLink = href;
          return false;
        }
      });
    }
    const isExternal = downloadLink && (downloadLink.includes("mega.nz") || downloadLink.includes("mediafire.com") || downloadLink.includes("drive.google.com"));
    const downloadInfo = {
      gameName,
      downloadLink,
      downloadPassword,
      isExternal,
      pageUrl: downloadPageUrl
    };
    console.log(`成功提取下载信息：${gameName}`);
    if (downloadLink) {
      writeCache(downloadPageUrl, downloadInfo);
      return { ...downloadInfo, fromCache: false };
    } else {
      return { ...downloadInfo, error: "未找到下载链接", fromCache: false };
    }
  } catch (err) {
    console.error("获取下载信息失败:", err.message);
    const cached2 = readCache(downloadPageUrl);
    if (cached2) {
      return { ...cached2, fromCache: true, error: "网络错误，使用缓存" };
    }
    return { error: "获取下载信息失败，请检查网络", pageUrl: downloadPageUrl };
  }
}
process.on("uncaughtException", (error) => {
  console.error("未捕获的异常:", error);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("未处理的 Promise 拒绝:", reason);
});
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
require("https");
require("http");
const { URL } = require("url");
const axios = require("axios");
const packageJson = require("../../package.json");
process.env.NODE_ENV === "development";
function getDefaultImage() {
  if (process.env.NODE_ENV === "development") {
    return "/pic/default.png";
  } else {
    return "./pic/default.png";
  }
}
const userDataPath = app.getPath("userData");
path.join(userDataPath, "cache");
const { Menu } = require("electron");
const menu = Menu.buildFromTemplate([]);
Menu.setApplicationMenu(menu);
let windows = [];
function createWindow() {
  const appVersion = packageJson.version || "0.0.0";
  const mainWindow = new BrowserWindow({
    width: 1e3,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      sandbox: false,
      // devTools: process.env.NODE_ENV === 'development',
      devTools: false
    }
  });
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.setTitle(`风灵月影宗 v${appVersion}`);
  });
  windows.push(mainWindow);
  mainWindow.on("closed", () => {
    windows = windows.filter((win) => win !== mainWindow);
  });
  return mainWindow;
}
function createDetailWindow(url) {
  const detailWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  detailWindow.loadURL(url);
  windows.push(detailWindow);
  detailWindow.on("closed", () => {
    windows = windows.filter((win) => win !== detailWindow);
  });
  return detailWindow;
}
app.whenReady().then(() => {
  try {
    const mainWindow = createWindow();
    app.on("activate", function() {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error("创建窗口时出错:", error);
    app.quit();
  }
}).catch((error) => {
  console.error("应用启动失败:", error);
  app.quit();
});
app.on("window-all-closed", function() {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
ipcMain.handle("load-games-from-web", async () => {
  try {
    const result = await crawlIfUpdated();
    return {
      ...result,
      lastCheck: result.lastCheck ? new Date(result.lastCheck).toISOString() : void 0
    };
  } catch (err) {
    console.error("IPC handler error:", err);
    return { updated: false, data: [], error: "系统错误: " + err.message };
  }
});
ipcMain.handle("search-games", async (event, keyword) => {
  return await searchGames(keyword);
});
ipcMain.handle(
  "get-download-info",
  async (event, downloadPageUrl, gameName) => {
    const result = await getDownloadInfo(downloadPageUrl);
    if (gameName && gameName !== "未知游戏") {
      result.gameName = gameName;
    }
    return result;
  }
);
ipcMain.handle("open-detail-window", async (event, url) => {
  createDetailWindow(url);
  return { success: true };
});
const settingsFile = path.join(app.getPath("userData"), "settings.json");
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
ipcMain.handle("save-settings", async (event, settings) => {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (err) {
    console.error("保存设置失败:", err);
    return { success: false, error: err.message };
  }
});
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});
ipcMain.handle("download-file", async (event, url, folder) => {
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    console.log(`开始下载文件: ${url}`);
    console.log(`下载目录: ${folder}`);
    const response = await axios({
      method: "GET",
      url,
      responseType: "stream",
      timeout: 3e4,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Referer: "https://flingtrainer.com/"
      },
      // 跟随重定向
      maxRedirects: 5
    });
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    let fileName = null;
    const contentDisposition = response.headers["content-disposition"];
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (fileNameMatch) {
        fileName = fileNameMatch[1];
      }
    }
    if (!fileName) {
      const urlObj = new URL(url);
      fileName = path.basename(urlObj.pathname);
    }
    if (!path.extname(fileName)) {
      const contentType = response.headers["content-type"];
      if (contentType) {
        if (contentType.includes("application/x-rar")) {
          fileName += ".rar";
        } else if (contentType.includes("application/zip")) {
          fileName += ".zip";
        } else if (contentType.includes("application/x-msdownload") || contentType.includes("application/octet-stream")) {
          fileName += ".exe";
        } else {
          fileName += ".bin";
        }
      } else {
        fileName += ".bin";
      }
    }
    console.log(`文件名: ${fileName}`);
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
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    let downloadedSize = 0;
    response.data.on("data", (chunk) => {
      downloadedSize += chunk.length;
      console.log(`已下载: ${downloadedSize} 字节`);
    });
    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        const stats = fs.statSync(filePath);
        console.log(`下载完成，文件大小: ${stats.size} 字节`);
        if (stats.size === 0) {
          fs.unlinkSync(filePath);
          resolve({ success: false, error: "下载的文件为空" });
        } else {
          resolve({ success: true, fileName: path.basename(filePath) });
        }
      });
      writer.on("error", (err) => {
        console.error("写入文件失败:", err);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        resolve({ success: false, error: err.message });
      });
    });
  } catch (err) {
    console.error("下载失败:", err);
    return { success: false, error: err.message };
  }
});
ipcMain.handle("open-folder", async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (err) {
    console.error("打开文件夹失败:", err);
    return { success: false, error: err.message };
  }
});
ipcMain.handle("list-downloaded-files", async (event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: "下载文件夹不存在" };
    }
    const files = fs.readdirSync(folderPath);
    const validFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ext === ".exe" || ext === ".zip" || ext === ".rar" || ext === ".7z";
    });
    let gameData = [];
    try {
      const cacheDir2 = path.join(__dirname, "cache");
      const cacheFile = path.join(cacheDir2, "games.json");
      if (fs.existsSync(cacheFile)) {
        const cacheContent = fs.readFileSync(cacheFile, "utf-8");
        const cacheData = JSON.parse(cacheContent);
        gameData = cacheData.data || [];
      }
    } catch (cacheErr) {
      console.warn("读取游戏缓存数据失败:", cacheErr.message);
    }
    const fileList = validFiles.map((file) => {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);
      const ext = path.extname(file).toLowerCase();
      let gameImage = null;
      const fileNameWithoutExt = path.basename(file, path.extname(file));
      const matchedGame = gameData.find((game) => {
        if (!game.name) return false;
        const normalizedName = game.name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
        const normalizedFileName = fileNameWithoutExt.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
        return normalizedFileName.includes(normalizedName) || normalizedName.includes(normalizedFileName);
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
        image: gameImage || getDefaultImage()
      };
    });
    return { success: true, files: fileList };
  } catch (err) {
    console.error("读取下载文件夹失败:", err);
    return { success: false, error: err.message };
  }
});
ipcMain.handle("open-external-link", async (event, url) => {
  try {
    new URL(url);
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
ipcMain.handle("get-default-image", async () => {
  return getDefaultImage();
});
ipcMain.handle("format-file-size", async (event, bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
});
ipcMain.handle("format-date", async (event, date) => {
  return new Date(date).toLocaleString("zh-CN");
});
ipcMain.handle("launch-tool", async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (err) {
    console.error("启动工具失败:", err);
    return { success: false, error: err.message };
  }
});
ipcMain.handle("check-for-updates", async () => {
  return { hasUpdate: false };
});
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
