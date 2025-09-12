// 获取最近更新信息脚本

const { app } = require("electron");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

// ==================== 配置 ====================
const TARGET_URL = "https://flingtrainer.com";
// 延迟初始化 CACHE_DIR
let CACHE_DIR;
let CACHE_FILE;

function initCacheDir() {
  if (!CACHE_DIR) {
    CACHE_DIR = path.join(app.getPath("userData"), "cache");
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR); // 确保缓存目录存在
    CACHE_FILE = path.join(CACHE_DIR, "games-cache.json");
  }
  return { CACHE_DIR, CACHE_FILE };
}

// 缓存有效期
const LOCK_TIME = 30 * 60 * 1000;

// ==================== 缓存读写 ====================
function readCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      if (Date.now() - data.timestamp < LOCK_TIME) {
        return data.data;
      }
    } catch (e) {
      console.warn("缓存读取失败:", e.message);
    }
  }
  return null;
}

function writeCache(games) {
  fs.writeFileSync(
    CACHE_FILE,
    JSON.stringify(
      {
        data: games,
        timestamp: Date.now(),
      },
      null,
      2
    ),
    "utf-8"
  );
}

// ==================== 主爬取函数 ====================
async function fetchGames() {
  initCacheDir(); // 确保缓存目录已初始化
  const cache = readCache();
  if (cache) {
    console.log("使用缓存数据");
    return { updated: false, data: cache, fromCache: true };
  }

  console.log("正在获取首页数据...");

  try {
    const response = await axios.get(TARGET_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Referer: "https://www.google.com/",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    const $items = $(".post-standard"); // 每个游戏条目
    console.log(`找到 ${$items.length} 个游戏条目`);

    const games = [];
    $items.each((i, el) => {
      const $el = $(el);
      const name = $el.find(".post-content .post-title a").text().trim();
      const img =
        $el.find(".post-details .post-details-thumb img").attr("src") ||
        $el
          .find(".post-details .post-details-thumb img")
          .attr("data-lazy-src") ||
        null;
      const downloadPageLink = $el
        .find(".post-content .post-title a")
        .attr("href");

      if (name && downloadPageLink) {
        games.push({ name, img, downloadPageLink });
      }
    });

    console.log(`成功提取 ${games.length} 个游戏`);

    if (games.length > 0) {
      writeCache(games);
      return { updated: true, data: games, fromCache: false };
    } else {
      return { error: "未找到游戏数据", data: [] };
    }
  } catch (err) {
    console.error("获取失败:", err.message);
    const cache = readCache();
    if (cache) {
      return {
        updated: false,
        data: cache,
        fromCache: true,
        error: "网络错误，使用缓存",
      };
    }
    return { error: "网络错误且无缓存", data: [] };
  }
}

// 按需调用的主函数
async function crawlIfUpdated() {
  try {
    const result = await fetchGames();
    return result;
  } catch (err) {
    console.error("crawlIfUpdated 执行出错:", err);
    return { error: "系统错误: " + err.message, data: [] };
  }
}

// 导出函数供 main/index.js 调用
export { crawlIfUpdated };
