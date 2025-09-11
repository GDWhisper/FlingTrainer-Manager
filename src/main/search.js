// searchCrawler.js - 用于 Electron 应用的搜索爬虫
// 使用 axios + cheerio 架构

const { app } = require("electron");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

// 缓存目录 - 统一使用 cache 文件夹
// 延迟初始化缓存目录
let CACHE_DIR;

function initCacheDir() {
  if (!CACHE_DIR) {
    CACHE_DIR = path.join(app.getPath("userData"), "cache", "search-cache");
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  return CACHE_DIR;
}

// 缓存有效期
const CACHE_TTL = 30 * 60 * 1000;

// 根据关键词生成缓存文件路径
function getCachePath(keyword) {
  const CACHE_DIR = initCacheDir();
  const sanitized = keyword.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_");
  return path.join(CACHE_DIR, `${sanitized}.json`);
}

// 读取缓存
function readCache(keyword) {
  initCacheDir(); // 确保缓存目录已初始化
  const cachePath = getCachePath(keyword);
  if (fs.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      if (Date.now() - data.timestamp < CACHE_TTL) {
        console.log(`使用缓存数据：${keyword}`);
        return data.games;
      }
    } catch (e) {
      console.warn("缓存读取失败:", e.message);
    }
  }
  return null;
}

// 写入缓存
function writeCache(keyword, games) {
  initCacheDir(); // 确保缓存目录已初始化
  const cachePath = getCachePath(keyword);
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ games, timestamp: Date.now() }, null, 2),
    "utf-8"
  );
}

// 主搜索函数
async function searchGames(keyword) {
  initCacheDir(); // 确保缓存目录已初始化
  if (!keyword || typeof keyword !== "string") {
    return { error: "无效的搜索关键词", data: [] };
  }

  // 优先使用缓存
  const cached = readCache(keyword);
  if (cached) {
    return { updated: false, data: cached, fromCache: true };
  }

  const SEARCH_URL = `https://flingtrainer.com/?s=${encodeURIComponent(
    keyword
  )}`;

  try {
    console.log(`正在搜索：${keyword}`);
    console.log(`访问：${SEARCH_URL}`);

    const response = await axios.get(SEARCH_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Referer: "https://www.google.com/",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    const $items = $(".post-standard");
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
      writeCache(keyword, games);
      return { updated: true, data: games, fromCache: false };
    } else {
      return { error: "未找到相关游戏", data: [] };
    }
  } catch (err) {
    console.error("搜索失败:", err.message);
    const cached = readCache(keyword);
    if (cached) {
      return {
        updated: false,
        data: cached,
        fromCache: true,
        error: "网络错误，使用缓存",
      };
    }
    return { error: "搜索失败，请检查网络", data: [] };
  }
}

// 导出函数
export { searchGames };
