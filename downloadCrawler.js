// downloadCrawler.js - 修改后的版本
const { chromium } = require("playwright");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

// 缓存目录
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);
const DOWNLOAD_CACHE_DIR = path.join(CACHE_DIR, "download-cache");
if (!fs.existsSync(DOWNLOAD_CACHE_DIR)) fs.mkdirSync(DOWNLOAD_CACHE_DIR);

// 缓存有效期：1小时
const CACHE_TTL = 60 * 60 * 1000;

// 根据URL生成缓存文件路径
function getCachePath(url) {
  const urlHash = require("crypto").createHash("md5").update(url).digest("hex");
  return path.join(DOWNLOAD_CACHE_DIR, `${urlHash}.json`);
}

// 读取缓存
function readCache(url) {
  const cachePath = getCachePath(url);
  if (fs.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      if (Date.now() - data.timestamp < CACHE_TTL) {
        console.log(`✅ 使用下载页面缓存数据：${url}`);
        return data.downloadInfo;
      }
    } catch (e) {
      console.warn("⚠️ 下载缓存读取失败:", e.message);
    }
  }
  return null;
}

// 写入缓存
function writeCache(url, downloadInfo) {
  const cachePath = getCachePath(url);
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ downloadInfo, timestamp: Date.now() }, null, 2),
    "utf-8"
  );
}

// 延时函数
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 获取下载信息
async function getDownloadInfo(downloadPageUrl) {
  if (!downloadPageUrl || typeof downloadPageUrl !== "string") {
    return { error: "无效的下载页面链接" };
  }

  // 优先使用缓存
  const cached = readCache(downloadPageUrl);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  let browser;
  try {
    console.log(`🔍 正在访问下载页面：${downloadPageUrl}`);

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-extensions",
        "--disable-plugins-discovery",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      referer: "https://flingtrainer.com/",
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // 隐藏自动化特征
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
        get: () => ({ query: () => Promise.resolve({ state: "granted" }) }),
      });
    });

    // 加载页面
    await page.goto(downloadPageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // 等待页面加载
    await sleep(1000 + Math.random() * 1000);

    const html = await page.content();
    await browser.close();

    const $ = cheerio.load(html);

    // 提取游戏名称
    const gameName =
      $(".post-title h1").text().trim() ||
      $(".post-title h2").text().trim() ||
      "未知游戏";

    // ✅ 优先从附件表格中获取第一个下载链接
    let downloadLink = null;
    let downloadPassword = null;

    // 1. 优先从 attachment-link 中找有效文件
    const $attachmentsTable = $(".da-attachments-table");
    if ($attachmentsTable.length > 0) {
      const $attachmentLinks = $attachmentsTable.find("a.attachment-link");
      for (let i = 0; i < $attachmentLinks.length; i++) {
        const $link = $($attachmentLinks[i]);
        const href = $link.attr("href");
        const text = $link.text().toLowerCase();

        const validExtensions = /\.(zip|exe|rar|7z|iso|bin)$/i;
        if (href && validExtensions.test(href)) {
          downloadLink = href;
          break;
        }
      }
    }

    // 2. 如果没找到，再尝试其他链接（排除 download.php）
    if (!downloadLink) {
      $(".entry-content a").each((i, el) => {
        const $el = $(el);
        const href = $el.attr("href");
        const text = $el.text().toLowerCase();

        if (
          href &&
          !href.includes("download.php") &&
          (href.includes("download") ||
            href.includes("attachment") ||
            text.includes("download") ||
            text.includes("下载"))
        ) {
          downloadLink = href;
          return false;
        }
      });
    }

    // 查找提取码/密码
    const contentText = $(".entry-content").text();
    const passwordPatterns = [
      /密码[:：]?\s*([a-zA-Z0-9]+)/,
      /提取码[:：]?\s*([a-zA-Z0-9]+)/,
      /code[:：]?\s*([a-zA-Z0-9]+)/,
      /密码\s*[:：]?\s*([^\s\n]+)/,
    ];

    for (const pattern of passwordPatterns) {
      const match = contentText.match(pattern);
      if (match) {
        downloadPassword = match[1];
        break;
      }
    }

    // 判断是否为外部链接
    const isExternal =
      downloadLink &&
      (downloadLink.includes("mega.nz") ||
        downloadLink.includes("mediafire.com") ||
        downloadLink.includes("drive.google.com"));

    const downloadInfo = {
      gameName,
      downloadLink,
      downloadPassword,
      isExternal,
      pageUrl: downloadPageUrl,
    };

    console.log(`✅ 成功提取下载信息：${gameName}`);

    if (downloadLink) {
      writeCache(downloadPageUrl, downloadInfo);
      return { ...downloadInfo, fromCache: false };
    } else {
      return { ...downloadInfo, error: "未找到下载链接", fromCache: false };
    }
  } catch (err) {
    console.error("❌ 获取下载信息失败:", err.message);
    if (browser) await browser.close().catch(() => {});

    const cached = readCache(downloadPageUrl);
    if (cached) {
      return { ...cached, fromCache: true, error: "网络错误，使用缓存" };
    }

    return { error: "获取下载信息失败，请检查网络", pageUrl: downloadPageUrl };
  }
}

// 导出函数
module.exports = { getDownloadInfo };
