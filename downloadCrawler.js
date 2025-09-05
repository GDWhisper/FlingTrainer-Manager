// downloadCrawler.js - 使用直接请求的高效版本
const axios = require("axios");
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

  try {
    console.log(`🔍 正在访问下载页面：${downloadPageUrl}`);

    // 使用 axios 直接请求页面内容，避免启动浏览器
    const response = await axios.get(downloadPageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": "https://flingtrainer.com/",
      },
      timeout: 10000, // 10秒超时
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 提取游戏名称
    const gameName =
      $(".post-title h1").first().text().trim() ||
      $(".post-title h2").first().text().trim() ||
      $("title").text().split(" - ")[0].trim() ||
      "未知游戏";

    // ✅ 优先从附件表格中获取第一个下载链接
    let downloadLink = null;
    let downloadPassword = null;

    // 1. 优先从 attachment-link 中找有效文件
    const $attachmentsTable = $(".da-attachments-table");
    if ($attachmentsTable.length > 0) {
      // 查找 class="zip alt" 或 class="zip" 的行
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

    const cached = readCache(downloadPageUrl);
    if (cached) {
      return { ...cached, fromCache: true, error: "网络错误，使用缓存" };
    }

    return { error: "获取下载信息失败，请检查网络", pageUrl: downloadPageUrl };
  }
}

// 导出函数
module.exports = { getDownloadInfo };