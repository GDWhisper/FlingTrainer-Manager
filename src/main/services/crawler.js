// 网页爬取服务 - 游戏列表和搜索

import { load } from 'cheerio';
import path from 'path';
import axios from 'axios';
import { TARGET_URL, CACHE_TTL, DEFAULT_HEADERS, IMAGE_CACHE_CONFIG, REQUEST_LIMITS } from '../constants.js';
import { getCacheDir, readCache, writeCache, getCachedImage, cacheImage } from '../utils/cache.js';
import { createHttpClient } from '../utils/http.js';
import { canMakeRefresh, recordRefresh, getRemainingRefreshes, getUsedRefreshes } from '../utils/requestLimiter.js';

/**
 * 下载并缓存图片
 * @param {string} imageUrl - 图片 URL
 * @returns {Promise<string|null>} 返回 base64 编码的图片或 null（如果下载失败）
 */
async function downloadAndCacheImage(imageUrl) {
  if (!imageUrl) return null;
  
  try {
    // 先检查是否已缓存
    const cached = getCachedImage(imageUrl);
    if (cached) {
      return cached;
    }

    // 下载图片
    const response = await axios.get(imageUrl, {
      headers: DEFAULT_HEADERS,
      responseType: 'arraybuffer',
      timeout: IMAGE_CACHE_CONFIG.TIMEOUT
    });

    if (response.status === 200 && response.data.length > 0) {
      const imageData = Buffer.from(response.data);
      await cacheImage(imageUrl, imageData);
      
      // 返回 base64 编码
      const base64 = imageData.toString('base64');
      const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
      const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
      return `data:${mimeType};base64,${base64}`;
    }
  } catch (err) {
    console.warn(`下载图片失败 ${imageUrl}:`, err.message);
  }
  
  return null;
}

/**
 * 从 cheerio 对象中解析游戏条目（共享解析逻辑）
 * @param {import('cheerio').CheerioAPI} $ - cheerio 实例
 * @returns {Array<{name: string, img: string|null, downloadPageLink: string}>}
 */
function parseGameItems($) {
  const games = [];
  $('.post-standard').each((_, el) => {
    const $el = $(el);
    const name = $el.find('.post-content .post-title a').text().trim();
    
    // 修复图片提取逻辑（参考 src_old/main/games.js）
    let img = null;
    const $imgEl = $el.find('.post-details .post-details-thumb img');
    if ($imgEl.length > 0) {
      // 优先获取 src 属性
      img = $imgEl.attr('src');
      // 如果没有 src，尝试 data-lazy-src 属性
      if (!img) {
        img = $imgEl.attr('data-lazy-src');
      }
      // 如果仍然没有，尝试 data-src 属性
      if (!img) {
        img = $imgEl.attr('data-src');
      }
      // 如果是相对路径，补全为绝对路径
      if (img && img.startsWith('/')) {
        img = new URL(img, TARGET_URL).href;
      }
    }
    
    const downloadPageLink = $el
      .find('.post-content .post-title a')
      .attr('href');

    if (name && downloadPageLink) {
      games.push({ name, img, downloadPageLink });
    }
  });
  return games;
}

/**
 * 批量下载并缓存图片
 * @param {Array} games - 游戏数组
 * @returns {Promise<Array>} 更新后的游戏数组（包含 base64 图片）
 */
async function cacheGamesImages(games) {
  console.log(`正在为 ${games.length} 个游戏下载图片...`);
  
  // 限制并发数量，避免同时发起太多请求
  const results = [];
  
  for (let i = 0; i < games.length; i += IMAGE_CACHE_CONFIG.CONCURRENCY_LIMIT) {
    const batch = games.slice(i, i + IMAGE_CACHE_CONFIG.CONCURRENCY_LIMIT);
    const promises = batch.map(async (game) => {
      if (game.img) {
        const base64Img = await downloadAndCacheImage(game.img);
        return { ...game, img: base64Img || game.img };
      }
      return game;
    });
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    
    console.log(`已处理 ${Math.min(i + IMAGE_CACHE_CONFIG.CONCURRENCY_LIMIT, games.length)}/${games.length} 个图片`);
  }
  
  return results;
}

/**
 * 获取首页最近更新的游戏列表
 * @param {boolean} forceRefresh - 是否强制刷新（忽略缓存）
 */
export async function fetchHomepageGames(forceRefresh = false) {
  const cacheDir = getCacheDir('');
  const cacheFile = path.join(cacheDir, 'games-cache.json');

  // 如果强制刷新，检查限制条件
  if (forceRefresh) {
    // 检查每日限额
    if (!canMakeRefresh()) {
      return { 
        error: `今日刷新次数已达上限 (${REQUEST_LIMITS.MAX_REFRESH_PER_DAY}次)，请明日再试`,
        data: [],
        fromCache: false
      };
    }
    
    // 记录请求
    recordRefresh();
    console.log(`执行强制刷新，今日已使用 ${getUsedRefreshes()}/${REQUEST_LIMITS.MAX_REFRESH_PER_DAY} 次`);
  }

  // 如果非强制刷新，优先使用缓存
  if (!forceRefresh) {
    // 优先使用缓存
    const cached = readCache(cacheFile, CACHE_TTL.GAMES);
    if (cached) {
      console.log('使用缓存数据');
      // 缓存数据已经包含 base64 图片，直接返回
      return { updated: false, data: cached, fromCache: true };
    }
  } else {
    console.log('强制刷新，跳过缓存检查');
  }

  console.log('正在获取首页数据...');

  try {
    const client = createHttpClient();
    const response = await client.get(TARGET_URL);
    const $ = load(response.data);
    const games = parseGameItems($);

    console.log(
      `找到 ${$('.post-standard').length} 个游戏条目，成功提取 ${games.length} 个游戏`
    );

    if (games.length > 0) {
      // 下载并缓存图片
      const gamesWithImages = await cacheGamesImages(games);
      writeCache(cacheFile, gamesWithImages);
      return { updated: true, data: gamesWithImages, fromCache: false };
    }
    return { error: '未找到游戏数据', data: [] };
  } catch (err) {
    console.error('获取失败:', err.message);
    // 如果是强制刷新失败，尝试返回缓存数据（即使过期）
    const fallback = readCache(cacheFile, 0); // ttl 设为 0，读取任何缓存
    if (fallback) {
      return {
        updated: false,
        data: fallback,
        fromCache: true,
        error: '网络错误，使用过期缓存',
      };
    }
    return { error: '网络错误且无缓存', data: [] };
  }
}

/**
 * 搜索游戏
 * @param {string} keyword - 搜索关键词
 * @param {boolean} forceRefresh - 是否强制刷新（忽略缓存）
 */
export async function searchGames(keyword, forceRefresh = false) {
  if (!keyword || typeof keyword !== 'string') {
    return { error: '无效的搜索关键词', data: [] };
  }

  const cacheDir = getCacheDir('search-cache');
  const sanitized = keyword.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
  const cacheFile = path.join(cacheDir, `${sanitized}.json`);

  // 如果非强制刷新，优先使用缓存
  if (!forceRefresh) {
    // 优先使用缓存
    const cached = readCache(cacheFile, CACHE_TTL.SEARCH);
    if (cached) {
      console.log(`使用缓存数据：${keyword}`);
      return { updated: false, data: cached, fromCache: true };
    }
  } else {
    console.log(`强制刷新搜索：${keyword}`);
  }

  const searchUrl = `${TARGET_URL}/?s=${encodeURIComponent(keyword)}`;

  try {
    console.log(`正在搜索：${keyword}`);
    // 启用随机延迟（1-3 秒），避免被识别为机器人
    const client = createHttpClient({}, true);
    const response = await client.get(searchUrl);
    const $ = load(response.data);
    const games = parseGameItems($);

    console.log(`成功提取 ${games.length} 个游戏`);

    if (games.length > 0) {
      // 下载并缓存图片
      const gamesWithImages = await cacheGamesImages(games);
      writeCache(cacheFile, gamesWithImages);
      return { updated: true, data: gamesWithImages, fromCache: false };
    }
    return { error: '未找到相关游戏', data: [] };
  } catch (err) {
    console.error('搜索失败:', err.message);
    // 如果是强制刷新失败，尝试返回缓存数据（即使过期）
    const fallback = readCache(cacheFile, 0); // ttl 设为 0，读取任何缓存
    if (fallback) {
      return {
        updated: false,
        data: fallback,
        fromCache: true,
        error: '网络错误，使用过期缓存',
      };
    }
    return { error: '搜索失败，请检查网络', data: [] };
  }
}
