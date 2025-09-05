// searchCrawler.js - 用于 Electron 应用的搜索爬虫
// 导出 searchGames 函数，接收关键词，返回游戏列表

const { chromium } = require('playwright');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// 缓存目录 - 统一使用 cache 文件夹
const CACHE_DIR = path.join(__dirname, 'cache', 'search-cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });


// 缓存有效期：1 小时
const CACHE_TTL = 60 * 60 * 1000;

// 根据关键词生成缓存文件路径
function getCachePath(keyword) {
  const sanitized = keyword.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
  return path.join(CACHE_DIR, `${sanitized}.json`);
}

// 读取缓存
function readCache(keyword) {
  const cachePath = getCachePath(keyword);
  if (fs.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (Date.now() - data.timestamp < CACHE_TTL) {
        console.log(`✅ 使用缓存数据：${keyword}`);
        return data.games;
      }
    } catch (e) {
      console.warn('⚠️ 缓存读取失败:', e.message);
    }
  }
  return null;
}

// 写入缓存
function writeCache(keyword, games) {
  const cachePath = getCachePath(keyword);
  fs.writeFileSync(
    cachePath,
    JSON.stringify(
      { games, timestamp: Date.now() },
      null,
      2
    ),
    'utf-8'
  );
}

// 延时函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主搜索函数
async function searchGames(keyword) {
  if (!keyword || typeof keyword !== 'string') {
    return { error: '无效的搜索关键词', data: [] };
  }

  // 优先使用缓存
  const cached = readCache(keyword);
  if (cached) {
    return { updated: false, data: cached, fromCache: true };
  }

  const SEARCH_URL = `https://flingtrainer.com/?s=${encodeURIComponent(keyword)}`;
  let browser;

  try {
    console.log(`🔍 正在搜索：${keyword}`);
    console.log(`🌐 访问：${SEARCH_URL}`);

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-extensions',
        '--disable-plugins-discovery',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows'
      ]
    });

    const randomUA = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    ][Math.floor(Math.random() * 2)];

    const context = await browser.newContext({
      userAgent: randomUA,
      referer: 'https://www.google.com/',
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true
    });

    const page = await context.newPage();

    // 隐藏自动化特征
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.navigator.chrome = {};
      Object.defineProperty(navigator, 'permissions', {
        get: () => ({ query: () => Promise.resolve({ state: 'granted' }) })
      });
    });

    // 加载页面
    await page.goto(SEARCH_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // 模拟人类行为
    await sleep(2000 + Math.random() * 3000);
    await page.evaluate(() => window.scrollBy(0, 200));

    const html = await page.content();
    await browser.close();

    const $ = cheerio.load(html);
    const $items = $('.post-standard');
    const games = [];

    $items.each((i, el) => {
      const $el = $(el);
      const name = $el.find('.post-content .post-title a').text().trim();
      const img = $el.find('.post-details .post-details-thumb img').attr('src') ||
                  $el.find('.post-details .post-details-thumb img').attr('data-lazy-src') ||
                  null;
      const downloadPageLink = $el.find('.post-content .post-title a').attr('href');

      if (name && downloadPageLink) {
        games.push({ name, img, downloadPageLink });
      }
    });

    console.log(`✅ 成功提取 ${games.length} 个游戏`);

    if (games.length > 0) {
      writeCache(keyword, games);
      return { updated: true, data: games, fromCache: false };
    } else {
      return { error: '未找到相关游戏', data: [] };
    }
  } catch (err) {
    console.error('❌ 搜索失败:', err.message);
    if (browser) await browser.close().catch(() => {});
    const cached = readCache(keyword);
    if (cached) {
      return { updated: false, data: cached, fromCache: true, error: '网络错误，使用缓存' };
    }
    return { error: '搜索失败，请检查网络', data: [] };
  }
}

// ✅ 导出函数供 Electron 调用
module.exports = { searchGames };