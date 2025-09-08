// crawler.js - 高隐蔽性 Playwright 爬虫
// 用于抓取 https://flingtrainer.com 的游戏名称、图片、下载页链接

const { app } = require("electron");
const { chromium } = require("playwright");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

// ==================== 配置 ====================
const TARGET_URL = "https://flingtrainer.com";
// 延迟初始化 CACHE_DIR，确保 app 已经准备好
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

const LOCK_TIME = 60 * 60 * 1000; // 缓存有效期：1小时
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
];

// ==================== 缓存读写 ====================
function readCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      if (Date.now() - data.timestamp < LOCK_TIME) {
        return data.data;
      }
    } catch (e) {
      console.warn("⚠️ 缓存读取失败:", e.message);
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

// ==================== 延时函数 ====================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== 主爬取函数 ====================
async function fetchGames() {
  initCacheDir(); // 确保缓存目录已初始化
  const cache = readCache();
  if (cache) {
    console.log("✅ 使用缓存数据");
    return { updated: false, data: cache, fromCache: true };
  }

  console.log("🔍 正在启动浏览器并抓取首页数据...");

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, // 使用环境变量指定浏览器路径
    });

    // 随机 User-Agent
    const randomUA =
      USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    const context = await browser.newContext({
      userAgent: randomUA,
      referer: "https://www.google.com/",
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // === 隐藏 Playwright 自动化特征 ===
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
      window.navigator.chrome = {};
      Object.defineProperty(navigator, "permissions", {
        get: () => ({
          query: () => Promise.resolve({ state: "granted" }),
        }),
      });
    });

    // === 拦截非关键资源（加速加载）===
    await page
      .route("**/*", (route) => {
        const blocked = ["image", "stylesheet", "font", "media", "other"];
        if (blocked.includes(route.request().resourceType())) {
          route.abort();
        } else {
          route.continue();
        }
      })
      .catch(() => {});

    console.log("🌐 正在访问 https://flingtrainer.com...");
    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // === 模拟人类行为 ===
    await sleep(1000 + Math.random() * 2000); // 随机等待
    await page.evaluate(() => window.scrollBy(0, 200)); // 模拟滚动

    // 获取页面内容
    const html = await page.content();
    const $ = cheerio.load(html);

    const $items = $(".post-standard"); // 每个游戏条目
    console.log(`🔍 找到 ${$items.length} 个游戏条目`);

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

    console.log(`✅ 成功提取 ${games.length} 个游戏`);

    if (games.length > 0) {
      writeCache(games);
      return { updated: true, data: games, fromCache: false };
    } else {
      return { error: "未找到游戏数据，请检查网站结构", data: [] };
    }
  } catch (err) {
    console.error("❌ 抓取失败:", err.message);
    if (err.message.includes("timeout")) {
      console.warn("💡 提示：可能是网络慢或反爬，请尝试 headless: false 查看");
    }
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
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// 按需调用的主函数
async function crawlIfUpdated() {
  try {
    const result = await fetchGames();
    return result;
  } catch (err) {
    console.error("❌ crawlIfUpdated 执行出错:", err);
    return { error: "系统错误: " + err.message, data: [] };
  }
}

// 导出函数供 main.js 调用
module.exports = { crawlIfUpdated };