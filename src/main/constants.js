// 共享常量

// 应用版本
export const APP_VERSION = '0.2.6';

// 目标网站
export const TARGET_URL = 'https://flingtrainer.com';

// HTTP 请求头
export const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Referer: 'https://www.google.com/',
};

// 缓存有效期（毫秒）
export const CACHE_TTL = {
  GAMES: 12 * 60 * 60 * 1000, // 游戏列表缓存：12 小时
  SEARCH: 12 * 60 * 60 * 1000, // 搜索结果缓存：12 小时
  DOWNLOAD: 10 * 60 * 1000, // 下载信息缓存：10 分钟
};

// 请求限制配置
export const REQUEST_LIMITS = {
  REFRESH_COOLDOWN: 60 * 1000, // 刷新冷却时间：60 秒
  MAX_REFRESH_PER_DAY: 30, // 每日最多刷新次数：30 次
  RANDOM_DELAY_MIN: 1000, // 搜索最小延迟：1 秒
  RANDOM_DELAY_MAX: 3000, // 搜索最大延迟：3 秒
};

// 图片缓存配置
export const IMAGE_CACHE_CONFIG = {
  MAX_SIZE: 50 * 1024 * 1024, // 最大 50MB
  CONCURRENCY_LIMIT: 3, // 并发下载限制
  TIMEOUT: 10000, // 下载超时 10 秒
};

// 请求超时（毫秒）
export const REQUEST_TIMEOUT = 30000;
