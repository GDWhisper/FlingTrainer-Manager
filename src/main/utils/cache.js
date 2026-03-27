// 统一缓存工具

import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { IMAGE_CACHE_CONFIG } from '../constants.js';

// 缓存根目录（延迟初始化）
let _cacheRootDir = null;

/**
 * 获取应用安装目录或可执行文件所在目录
 * 用于实现绿色便携化，所有数据保存在应用目录内
 */
function getAppDataPath() {
  // 开发环境：使用项目根目录下的 .data 文件夹
  if (process.env.NODE_ENV === 'development') {
    const devPath = path.join(__dirname, '../../.data');
    if (!fs.existsSync(devPath)) {
      fs.mkdirSync(devPath, { recursive: true });
    }
    return devPath;
  }
  
  // 生产环境：使用可执行文件所在目录
  try {
    const exePath = process.execPath;
    const exeDir = path.dirname(exePath);
    
    // 检查是否有写入权限（某些安装目录可能需要特殊处理）
    const appDataDir = path.join(exeDir, 'FlingTrainer-Manager-Data');
    
    // 确保目录存在
    if (!fs.existsSync(appDataDir)) {
      try {
        fs.mkdirSync(appDataDir, { recursive: true });
      } catch (err) {
        console.warn('无法在应用目录创建数据文件夹，回退到用户数据目录:', err.message);
        // 如果无法在应用目录创建，则回退到用户数据目录
        return path.join(app.getPath('userData'), 'FlingTrainer-Manager');
      }
    }
    
    return appDataDir;
  } catch (err) {
    console.error('获取应用路径失败:', err.message);
    // 出错时回退到用户数据目录
    return path.join(app.getPath('userData'), 'FlingTrainer-Manager');
  }
}

/**
 * 获取缓存根目录，确保其存在
 * 优先使用应用安装目录，实现绿色便携
 */
function getCacheRootDir() {
  if (!_cacheRootDir) {
    const appDataPath = getAppDataPath();
    _cacheRootDir = path.join(appDataPath, 'cache');
    if (!fs.existsSync(_cacheRootDir)) {
      fs.mkdirSync(_cacheRootDir, { recursive: true });
    }
  }
  return _cacheRootDir;
}

/**
 * 获取指定子目录的缓存路径，确保目录存在
 * @param {string} subdir - 子目录名（空字符串表示根缓存目录）
 * @returns {string} 子目录的完整路径
 */
export function getCacheDir(subdir) {
  const dir = path.join(getCacheRootDir(), subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 读取缓存
 * @param {string} cachePath - 缓存文件路径
 * @param {number} ttl - 缓存有效期（毫秒）
 * @returns {any|null} 缓存数据，过期或不存在返回 null
 */
export function readCache(cachePath, ttl) {
  if (fs.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (Date.now() - data.timestamp < ttl) {
        return data.data;
      }
    } catch (e) {
      console.warn('缓存读取失败:', e.message);
    }
  }
  return null;
}

/**
 * 写入缓存
 * @param {string} cachePath - 缓存文件路径
 * @param {any} data - 要缓存的数据
 */
export function writeCache(cachePath, data) {
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ data, timestamp: Date.now() }, null, 2),
    'utf-8'
  );
}

/**
 * 获取文件夹大小（递归计算）
 * @param {string} dir - 目录路径
 * @returns {number} 文件夹大小（字节）
 */
function getDirSize(dir) {
  let size = 0;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        size += getDirSize(filePath);
      } else {
        size += stats.size;
      }
    }
  } catch (err) {
    console.warn('计算文件夹大小失败:', err.message);
  }
  return size;
}

/**
 * 清理最旧的文件直到总大小低于限制
 * @param {string} dir - 目录路径
 * @param {number} maxSize - 最大大小（字节）
 */
function cleanupOldFiles(dir, maxSize) {
  try {
    const files = fs.readdirSync(dir).map(file => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        name: file,
        size: stats.size,
        mtime: stats.mtimeMs,
        isDirectory: stats.isDirectory()
      };
    });

    // 按修改时间排序，最旧的在前
    files.sort((a, b) => a.mtime - b.mtime);

    let currentSize = files.reduce((sum, f) => sum + f.size, 0);

    // 删除最旧的文件直到总大小低于限制
    while (currentSize > maxSize && files.length > 0) {
      const oldest = files.shift();
      if (!oldest.isDirectory) {
        fs.unlinkSync(oldest.path);
        currentSize -= oldest.size;
        console.log(`清理过期文件：${oldest.name}`);
      }
    }
  } catch (err) {
    console.error('清理缓存文件失败:', err.message);
  }
}

/**
 * 保存图片到本地缓存
 * @param {string} imageUrl - 图片 URL
 * @param {Buffer} imageData - 图片二进制数据
 */
export async function cacheImage(imageUrl, imageData) {
  try {
    const imageCacheDir = getCacheDir('images');
    
    // 从 URL 生成文件名（使用 MD5 或简化路径）
    const urlHash = Buffer.from(imageUrl).toString('base64').replace(/[/+=]/g, '_');
    const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const fileName = `${urlHash}${ext}`;
    const filePath = path.join(imageCacheDir, fileName);

    // 写入图片
    fs.writeFileSync(filePath, imageData);
    
    // 检查并清理缓存，确保不超过大小限制
    const totalSize = getDirSize(imageCacheDir);
    
    if (totalSize > IMAGE_CACHE_CONFIG.MAX_SIZE) {
      cleanupOldFiles(imageCacheDir, IMAGE_CACHE_CONFIG.MAX_SIZE);
    }
  } catch (err) {
    console.warn('缓存图片失败:', err.message);
  }
}

/**
 * 从缓存读取图片
 * @param {string} imageUrl - 图片 URL
 * @returns {string|null} 图片的 base64 编码或 null
 */
export function getCachedImage(imageUrl) {
  try {
    const imageCacheDir = getCacheDir('images');
    const urlHash = Buffer.from(imageUrl).toString('base64').replace(/[/+=]/g, '_');
    const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const fileName = `${urlHash}${ext}`;
    const filePath = path.join(imageCacheDir, fileName);

    if (fs.existsSync(filePath)) {
      const imageData = fs.readFileSync(filePath);
      const base64 = imageData.toString('base64');
      const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
      return `data:${mimeType};base64,${base64}`;
    }
  } catch (err) {
    console.warn('读取缓存图片失败:', err.message);
  }
  return null;
}

/**
 * 获取缓存根目录路径（供外部使用，如读取游戏缓存匹配图片）
 */
export function getCacheRootPath() {
  return getCacheRootDir();
}

/**
 * 获取应用数据目录路径（供外部使用）
 */
export function getAppDataDirectory() {
  return getAppDataPath();
}
