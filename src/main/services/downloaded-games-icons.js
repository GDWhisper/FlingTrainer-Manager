// 下载管理器 - 负责管理所有下载任务

import { load } from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { CACHE_TTL } from '../constants.js';
import { getCacheDir, readCache, writeCache } from '../utils/cache.js';
import { createHttpClient } from '../utils/http.js';
import { app } from 'electron';

// 获取数据目录路径（绿色存储策略）
function getDataDirectory() {
  // 开发环境：使用项目根目录下的 .data 文件夹
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    const devPath = path.join(process.cwd(), '.data');
    if (!fs.existsSync(devPath)) {
      fs.mkdirSync(devPath, { recursive: true });
    }
    return devPath;
  }
  
  // 生产环境：使用可执行文件所在目录
  try {
    const exePath = process.execPath;
    const exeDir = path.dirname(exePath);
    const appDataDir = path.join(exeDir, 'FlingTrainer-Manager-Data');
    
    // 确保目录存在
    if (!fs.existsSync(appDataDir)) {
      try {
        fs.mkdirSync(appDataDir, { recursive: true });
      } catch (err) {
        console.warn('无法在应用目录创建数据文件夹，回退到用户数据目录:', err.message);
        return path.join(app.getPath('userData'), 'FlingTrainer-Manager');
      }
    }
    
    return appDataDir;
  } catch (err) {
    console.error('获取数据目录失败:', err);
    return path.join(app.getPath('userData'), 'FlingTrainer-Manager');
  }
}

// 已下载游戏图标映射管理
class DownloadedGamesIconManager {
  constructor() {
    const dataDir = getDataDirectory();
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
        const crypto = require('crypto');
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        fileHash = hashSum.digest('hex');
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
      
      // 如果文件还存在，验证哈希值确保删除正确的记录
      if (record.filePath && fs.existsSync(record.filePath)) {
        try {
          const crypto = require('crypto');
          const fileBuffer = fs.readFileSync(record.filePath);
          const hashSum = crypto.createHash('sha256');
          hashSum.update(fileBuffer);
          const currentHash = hashSum.digest('hex');
          
          // 如果哈希值不匹配，说明文件已被替换或损坏
          if (record.fileHash && record.fileHash !== currentHash) {
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
      if (fs.existsSync(resolvedPath)) {
        const crypto = require('crypto');
        const fileBuffer = fs.readFileSync(resolvedPath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const currentHash = hashSum.digest('hex');
        
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
