// 下载服务 - 获取下载信息和文件下载

import { load } from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { CACHE_TTL } from '../constants.js';
import { getCacheDir, readCache, writeCache } from '../utils/cache.js';
import { createHttpClient } from '../utils/http.js';
import { downloadedGamesIconManager } from './downloaded-games-icons.js';

// 下载任务管理器（单例）
class DownloadManager {
  constructor() {
    this.tasks = new Map(); // 所有下载任务
    this.queue = []; // 等待队列
    this.activeCount = 0; // 当前活跃下载数
    this.maxConcurrent = 3; // 最大并发数
    this.listeners = new Set(); // 状态变化监听器
  }

  // 添加监听器
  onStatusChange(callback) {
    this.listeners.add(callback);
  }

  // 通知状态变化
  notifyStatusChange() {
    const tasksList = Array.from(this.tasks.values()).map(task => this.sanitizeTask(task));
    this.listeners.forEach(cb => cb(tasksList));
  }

  // 清理任务对象，移除不可序列化的字段
  sanitizeTask(task) {
    return {
      id: task.id,
      gameName: task.gameName,
      downloadUrl: task.downloadUrl,
      gameImage: task.gameImage, // 新增：游戏图标
      fileName: task.fileName,
      filePath: task.filePath,
      fileSize: task.fileSize,
      downloadedSize: task.downloadedSize,
      speed: task.speed,
      status: task.status,
      errorMessage: task.errorMessage,
      startTime: task.startTime,
      endTime: task.endTime,
      progress: task.progress,
      folder: task.folder
      // 注意：不包含 controller 字段（AbortController 不可序列化）
    };
  }

  // 生成任务 ID
  generateTaskId(url) {
    return crypto.createHash('md5').update(url + Date.now().toString()).digest('hex');
  }

  // 添加下载任务
  addTask(taskInfo) {
    const taskId = this.generateTaskId(taskInfo.downloadUrl);
    
    const task = {
      id: taskId,
      gameName: taskInfo.gameName,
      downloadUrl: taskInfo.downloadUrl,
      gameImage: taskInfo.gameImage || null, // 新增：游戏图标
      fileName: '',
      filePath: '',
      fileSize: 0,
      downloadedSize: 0,
      speed: 0, // 字节/秒
      status: 'queued', // queued, downloading, completed, cancelled, failed
      errorMessage: '',
      startTime: null,
      endTime: null,
      progress: 0,
      controller: null, // AbortController 用于取消
      folder: taskInfo.folder
    };

    this.tasks.set(taskId, task);
    this.queue.push(taskId);
    
    console.log(`添加下载任务：${taskInfo.gameName}, 当前队列长度：${this.queue.length}`);
    
    // 尝试启动队列中的任务
    this.processQueue();
    
    return taskId;
  }

  // 处理下载队列
  async processQueue() {
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const taskId = this.queue.shift();
      const task = this.tasks.get(taskId);
      
      if (task && task.status === 'queued') {
        this.activeCount++;
        this.startDownload(task).catch(err => {
          console.error(`下载任务 ${taskId} 失败:`, err);
        });
      }
    }
  }

  // 开始下载
  async startDownload(task) {
    task.status = 'downloading';
    task.startTime = Date.now();
    this.notifyStatusChange();

    try {
      const result = await this.performDownload(task);
      
      if (result.success) {
        task.status = 'completed';
        task.fileName = result.fileName;
        task.filePath = result.filePath;
        task.fileSize = result.fileSize;
        task.progress = 100;
      } else {
        task.status = 'failed';
        task.errorMessage = result.error;
      }
      
      task.endTime = Date.now();
      this.activeCount--;
      this.notifyStatusChange();
      
      // 继续处理队列
      this.processQueue();
      
    } catch (err) {
      console.error(`下载任务 ${task.id} 异常:`, err);
      task.status = 'failed';
      task.errorMessage = err.message;
      task.endTime = Date.now();
      this.activeCount--;
      this.notifyStatusChange();
      this.processQueue();
    }
  }

  // 执行下载（带速度计算）
  performDownload(task) {
    return new Promise(async (resolve) => {
      try {
        const client = createHttpClient({ 
          Referer: 'https://flingtrainer.com/',
          'Accept': '*/*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        });

        const response = await client.get(task.downloadUrl, {
          responseType: 'stream',
          maxRedirects: 5,
          timeout: 60000,
        });

        // 获取文件大小
        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        task.fileSize = totalSize;

        // 提取文件名
        let fileName = '';
        const disposition = response.headers['content-disposition'];
        if (disposition) {
          const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match) {
            fileName = match[1].replace(/['"]/g, '');
            fileName = decodeURIComponent(fileName);
          }
        }

        if (!fileName) {
          try {
            const urlObj = new URL(task.downloadUrl);
            fileName = path.basename(urlObj.pathname);
          } catch {
            fileName = 'download.zip';
          }
        }

        fileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
        
        // 确保目录存在
        if (!fs.existsSync(task.folder)) {
          fs.mkdirSync(task.folder, { recursive: true });
        }

        // 处理文件名冲突
        let filePath = path.join(task.folder, fileName);
        let counter = 1;
        const nameWithoutExt = path.basename(fileName, path.extname(fileName));
        const ext = path.extname(fileName);
        while (fs.existsSync(filePath)) {
          filePath = path.join(task.folder, `${nameWithoutExt}(${counter})${ext}`);
          counter++;
        }

        task.fileName = fileName;
        task.filePath = filePath;

        console.log(`开始下载：${fileName}, 大小：${(totalSize / 1024 / 1024).toFixed(2)} MB`);

        const writer = fs.createWriteStream(filePath);
        
        // 速度计算相关
        let downloadedSize = 0;
        let lastSize = 0;
        let lastTime = Date.now();
        let speedSamples = []; // 最近的速度样本

        // 设置 AbortController 用于取消
        task.controller = { abort: () => response.data.destroy() };

        response.data.on('data', (chunk) => {
          downloadedSize += chunk.length;
          task.downloadedSize = downloadedSize;
          
          // 计算瞬时速度（每 500ms 采样一次）
          const now = Date.now();
          if (now - lastTime >= 500) {
            const delta = downloadedSize - lastSize;
            const timeDelta = (now - lastTime) / 1000; // 转换为秒
            const instantSpeed = delta / timeDelta;
            
            // 保存最近 5 个速度样本，计算平均值
            speedSamples.push(instantSpeed);
            if (speedSamples.length > 5) {
              speedSamples.shift();
            }
            
            task.speed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
            
            lastSize = downloadedSize;
            lastTime = now;
            
            // 计算进度
            if (totalSize > 0) {
              task.progress = Math.min(100, (downloadedSize / totalSize) * 100);
            }
            
            // 通知 UI 更新（限制频率，每秒最多 2 次）
            this.notifyStatusChange();
          }
        });

        response.data.on('error', (err) => {
          console.error('下载流错误:', err);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          resolve({ success: false, error: err.message });
        });

        writer.on('finish', () => {
          const stats = fs.statSync(filePath);
          const actualFileName = path.basename(filePath); // 使用实际保存的文件名
          console.log(`下载完成：${actualFileName}, 大小：${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          
          if (stats.size === 0) {
            fs.unlinkSync(filePath);
            resolve({ success: false, error: '下载的文件为空' });
          } else {
            // 保存图标映射记录（使用实际文件名和完整路径）
            if (task.gameImage) {
              downloadedGamesIconManager.addOrUpdate(
                task.id,
                task.gameName,
                task.gameImage,
                task.downloadUrl,
                actualFileName,
                filePath // 传递完整文件路径用于计算哈希
              );
              console.log(`已保存游戏图标映射：${task.gameName} -> ${actualFileName}`);
            }
            
            resolve({ success: true, fileName: actualFileName, filePath, fileSize: stats.size });
          }
        });

        writer.on('error', (err) => {
          console.error('写入文件失败:', err);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          resolve({ success: false, error: err.message });
        });

        response.data.pipe(writer);
        
      } catch (err) {
        console.error('下载失败:', err.message);
        resolve({ success: false, error: err.message });
      }
    });
  }

  // 取消下载
  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'downloading') {
      // 正在下载中，中断连接
      if (task.controller) {
        task.controller.abort();
      }
      task.status = 'cancelled';
      task.endTime = Date.now();
      this.activeCount--;
      
      // 删除未完成的文件
      if (task.filePath && fs.existsSync(task.filePath)) {
        fs.unlinkSync(task.filePath);
      }
      
      console.log(`取消下载任务：${task.gameName}`);
    } else if (task.status === 'queued') {
      // 从队列中移除
      const index = this.queue.indexOf(taskId);
      if (index > -1) {
        this.queue.splice(index, 1);
      }
      task.status = 'cancelled';
      task.endTime = Date.now();
      console.log(`取消排队任务：${task.gameName}`);
    } else {
      return false;
    }

    this.notifyStatusChange();
    this.processQueue();
    return true;
  }

  // 获取所有任务
  getAllTasks() {
    return Array.from(this.tasks.values()).map(task => this.sanitizeTask(task));
  }

  // 获取任务状态
  getTaskStatus(taskId) {
    const task = this.tasks.get(taskId);
    return task ? this.sanitizeTask(task) : null;
  }

  // 清除已完成/失败/取消的任务（保留最近的记录）
  clearFinishedTasks() {
    const now = Date.now();
    const keepTime = 24 * 60 * 60 * 1000; // 保留 24 小时
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (['completed', 'cancelled', 'failed'].includes(task.status)) {
        if (task.endTime && (now - task.endTime > keepTime)) {
          this.tasks.delete(taskId);
        }
      }
    }
    
    this.notifyStatusChange();
  }

  // 移除单个下载任务（包括文件记录和缓存）
  removeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // 如果是正在下载或排队的任务，先取消
    if (task.status === 'downloading' || task.status === 'queued') {
      this.cancelTask(taskId);
    }

    // 从图标映射中删除记录
    downloadedGamesIconManager.remove(taskId);
    
    // 从任务列表中删除
    this.tasks.delete(taskId);
    
    console.log(`移除下载任务：${task.gameName}`);
    
    this.notifyStatusChange();
    return true;
  }

  // 清除所有非下载中的任务（保留正在下载和排队的任务）
  clearAllNonDownloadingTasks() {
    for (const [taskId, task] of this.tasks.entries()) {
      // 只保留 downloading 和 queued 状态的任务
      if (task.status !== 'downloading' && task.status !== 'queued') {
        this.tasks.delete(taskId);
        console.log(`移除下载任务：${task.gameName} (状态：${task.status})`);
      }
    }
    
    this.notifyStatusChange();
  }
}

// 导出单例
export const downloadManager = new DownloadManager();

/**
 * 获取下载页面信息（下载链接、游戏名等）
 * @param {string} downloadPageUrl - 下载页面 URL
 */
export async function getDownloadInfo(downloadPageUrl) {
  if (!downloadPageUrl || typeof downloadPageUrl !== 'string') {
    return { error: '无效的下载页面链接' };
  }

  // 缓存
  const cacheDir = getCacheDir('download-cache');
  const urlHash = crypto
    .createHash('md5')
    .update(downloadPageUrl)
    .digest('hex');
  const cacheFile = path.join(cacheDir, `${urlHash}.json`);

  const cached = readCache(cacheFile, CACHE_TTL.DOWNLOAD);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  try {
    console.log(`正在访问下载页面：${downloadPageUrl}`);

    const client = createHttpClient({ Referer: 'https://flingtrainer.com/' });
    const response = await client.get(downloadPageUrl);
    const $ = load(response.data);

    let downloadLink = null;
    let downloadPassword = null;

    // 1. 优先从 attachment-link 中找有效文件（参考 src_old/download.js）
    const $attachmentsTable = $('.da-attachments-table');
    if ($attachmentsTable.length > 0) {
      // 查找 class="zip alt" 或 class="zip" 的行
      const $zipRows = $attachmentsTable.find("tr[class='zip alt'], tr[class='zip']");

      for (let i = 0; i < $zipRows.length; i++) {
        const $row = $($zipRows[i]);
        const $attachmentTitle = $row.find('.attachment-title');

        if ($attachmentTitle.length > 0) {
          const $link = $attachmentTitle.find('a.attachment-link');
          if ($link.length > 0) {
            const href = $link.attr('href');
            if (href && href.includes('downloads')) {
              downloadLink = href;
              break;
            }
          }
        }
      }
    }

    // 2. 如果没找到，再尝试其他链接（排除 download.php）
    if (!downloadLink) {
      $('.entry-content a').each((i, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        const text = $el.text().toLowerCase();

        if (
          href &&
          !href.includes('download.php') &&
          (href.includes('download') ||
            href.includes('attachment') ||
            text.includes('download') ||
            text.includes('下载'))
        ) {
          downloadLink = href;
          return false; // 跳出循环
        }
      });
    }

    // 3. 最后尝试从压缩文件扩展名查找
    if (!downloadLink) {
      downloadLink =
        $('a[href*=".zip"], a[href*=".rar"], a[href*=".7z"]').first().attr('href') ||
        $('a.btn-download').first().attr('href') ||
        null;
    }

    // 提取游戏名称
    const gameName =
      $('.post-title h1').first().text().trim() ||
      $('.post-title h2').first().text().trim() ||
      $('title').text().split(' - ')[0].trim() ||
      '未知游戏';

    // 判断是否为外部链接
    const isExternal =
      downloadLink &&
      (downloadLink.includes('mega.nz') ||
        downloadLink.includes('mediafire.com') ||
        downloadLink.includes('drive.google.com'));

    if (!downloadLink) {
      console.warn('未找到下载链接');
      return {
        error: '未找到下载链接',
        gameName,
        downloadLink: null,
        downloadPassword,
        isExternal: false,
        pageUrl: downloadPageUrl,
      };
    }

    // 处理相对 URL
    let resolvedLink = downloadLink;
    if (downloadLink.startsWith('/')) {
      resolvedLink = new URL(downloadLink, downloadPageUrl).href;
    }

    const info = {
      downloadLink: resolvedLink,
      gameName,
      downloadPassword,
      isExternal,
      pageUrl: downloadPageUrl,
    };

    writeCache(cacheFile, info);
    console.log(`下载信息提取成功：${gameName}`);
    return info;
  } catch (err) {
    console.error('获取下载信息失败:', err.message);
    const fallback = readCache(cacheFile, CACHE_TTL.DOWNLOAD);
    if (fallback) {
      return { ...fallback, fromCache: true, error: '网络错误，使用缓存数据' };
    }
    return { error: '获取下载信息失败，请检查网络' };
  }
}

/**
 * 旧的 downloadFile 函数已废弃，请使用 downloadManager
 * @deprecated
 */
export async function downloadFile(url, folder) {
  console.warn('downloadFile 已废弃，请使用 downloadManager');
  return { success: false, error: '请使用新的下载管理 API' };
}
