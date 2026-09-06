// 下载管理器 - 负责管理所有下载任务

import { load } from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { CACHE_TTL } from '../constants.js';
import { getAppDataDirectory, getCacheDir, readCache, writeCache } from '../utils/cache.js';
import { createHttpClient } from '../utils/http.js';

// 分块读取计算 SHA256：整文件 readFileSync 会把几百 MB 的安装包一次性读进内存
function hashFileSha256(filePath) {
  const CHUNK_SIZE = 4 * 1024 * 1024;
  const buffer = Buffer.alloc(CHUNK_SIZE);
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const hash = crypto.createHash('sha256');
    let bytesRead;
    while ((bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
    }
    return hash.digest('hex');
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* 忽略 */ }
    }
  }
}

// 已下载游戏图标映射管理
class DownloadedGamesIconManager {
  constructor() {
    const dataDir = getAppDataDirectory();
    this.iconMapFile = path.join(dataDir, 'downloaded-games.json');
    this.iconMap = { tasks: [] };
    this.load();
  }

  // 加载图标映射
  load() {
    try {
      if (fs.existsSync(this.iconMapFile)) {
        const data = fs.readFileSync(this.iconMapFile, 'utf-8');
        this.iconMap = JSON.parse(data);
      }
    } catch (err) {
      console.error('加载图标映射失败:', err.message);
      this.iconMap = { tasks: [] };
    }
  }

  // 保存图标映射
  save() {
    try {
      const dir = path.dirname(this.iconMapFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.iconMapFile, JSON.stringify(this.iconMap, null, 2), 'utf-8');
    } catch (err) {
      console.error('保存图标映射失败:', err.message);
    }
  }

  // 添加或更新图标记录
  addOrUpdate(taskId, gameName, gameImage, downloadUrl, fileName, filePath) {
    const index = this.iconMap.tasks.findIndex(t => t.id === taskId);
    
    // 计算文件哈希值（如果文件存在）
    let fileHash = null;
    try {
      if (fs.existsSync(filePath)) {
        fileHash = hashFileSha256(filePath);
        console.log(`文件哈希：${fileHash.substring(0, 16)}...`);
      }
    } catch (err) {
      console.error('计算文件哈希失败:', err.message);
    }
    
    const record = {
      id: taskId,
      gameName,
      gameImage,
      downloadUrl,
      fileName,
      filePath: path.resolve(filePath), // 保存绝对路径
      fileHash, // SHA256 哈希
      fileSize: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
      completedTime: Date.now()
    };

    if (index >= 0) {
      this.iconMap.tasks[index] = record;
    } else {
      this.iconMap.tasks.push(record);
    }

    this.save();
    console.log(`已保存游戏图标映射：${gameName} -> ${fileName}`);
  }

  // 移除图标记录
  remove(taskId) {
    const index = this.iconMap.tasks.findIndex(t => t.id === taskId);
    if (index >= 0) {
      const record = this.iconMap.tasks[index];
      
      // 如果文件还存在，核对哈希值确保删除正确的记录（仅在存过哈希时才值得算）
      if (record.filePath && record.fileHash && fs.existsSync(record.filePath)) {
        try {
          const currentHash = hashFileSha256(record.filePath);

          // 如果哈希值不匹配，说明文件已被替换或损坏
          if (record.fileHash !== currentHash) {
            console.warn(`[警告] 文件哈希不匹配，可能已被修改：${record.fileName}`);
          }
        } catch (err) {
          console.error('验证文件哈希失败:', err.message);
        }
      }
      
      this.iconMap.tasks.splice(index, 1);
      this.save();
      console.log(`已移除图标记录：${record.gameName}`);
      return true;
    }
    return false;
  }

  // 根据文件路径查找图标（优先使用路径匹配）
  findByFilePath(filePath) {
    const resolvedPath = path.resolve(filePath);
    
    // 1. 精确路径匹配
    const record = this.iconMap.tasks.find(t => t.filePath === resolvedPath);
    if (record) {
      console.log(`[图标匹配] 路径精确匹配：${record.gameName}`);
      return record.gameImage;
    }
    
    // 2. 文件名匹配（忽略大小写，作为降级方案）
    const fileName = path.basename(resolvedPath).toLowerCase();
    const recordByName = this.iconMap.tasks.find(t => {
      if (!t.fileName) return false;
      return t.fileName.toLowerCase() === fileName;
    });
    if (recordByName) {
      console.log(`[图标匹配] 文件名匹配：${recordByName.gameName}`);
      return recordByName.gameImage;
    }
    
    // 3. 哈希值匹配（如果文件被移动但内容未变）
    try {
      // 没有任何记录存过哈希时不值得把文件全读一遍
      if (fs.existsSync(resolvedPath) && this.iconMap.tasks.some((t) => t.fileHash)) {
        const currentHash = hashFileSha256(resolvedPath);

        const recordByHash = this.iconMap.tasks.find(t => t.fileHash && t.fileHash === currentHash);
        if (recordByHash) {
          console.log(`[图标匹配] 哈希值匹配：${recordByHash.gameName}`);
          return recordByHash.gameImage;
        }
      }
    } catch (err) {
      // 忽略哈希计算错误
    }
    
    return null;
  }

  // 根据下载 URL 查找图标
  findByDownloadUrl(downloadUrl) {
    const record = this.iconMap.tasks.find(t => t.downloadUrl === downloadUrl);
    return record ? record.gameImage : null;
  }

  // 获取所有图标记录
  getAllRecords() {
    return this.iconMap.tasks;
  }

  // 清理无效记录（可选：定期调用）
  cleanup() {
    // 这里可以添加清理逻辑，比如删除超过一定时间的记录
    // 目前暂不实现，保持长期缓存
  }
}

// 导出单例
export const downloadedGamesIconManager = new DownloadedGamesIconManager();
