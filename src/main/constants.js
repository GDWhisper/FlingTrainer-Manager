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

// 应用内更新配置（GitHub Releases，全自研实现，不依赖 electron-updater）
export const UPDATE_CONFIG = {
  // GitHub 基地址（本地冒烟测试可临时覆盖为 http://127.0.0.1:<port>，测完还原）
  GITHUB_BASE: 'https://github.com',
  GITHUB_OWNER: 'GDWhisper',
  GITHUB_REPO: 'FlingTrainer-Manager',
  // 更新说明页（用户可手动下载的兜底入口）
  RELEASES_PAGE_URL: 'https://github.com/GDWhisper/FlingTrainer-Manager/releases/latest',
  // 检查更新超时（毫秒）
  CHECK_TIMEOUT: 15000,
  // 下载请求超时（毫秒，与 downloader.js 同参数）
  DOWNLOAD_TIMEOUT: 60000,
  // 下载停滞判定：连续该时长未收到数据则判定为网络停滞（毫秒）
  STALL_TIMEOUT: 60000,
  // 下载中状态推送间隔（毫秒）
  NOTIFY_INTERVAL: 500,
  // 启动后静默检查更新的延迟（毫秒）
  STARTUP_CHECK_DELAY: 3000,
  // NSIS 卸载器文件名（exe 旁存在即判定为安装版，否则为便携 zip 版）
  UNINSTALLER_NAME: 'Uninstall 风灵月影宗.exe',
};
