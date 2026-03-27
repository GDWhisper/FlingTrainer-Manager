// 文件管理 IPC 处理器

import { ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { getCacheRootPath } from '../utils/cache.js';
import { downloadedGamesIconManager } from '../services/downloaded-games-icons.js';

export function registerFilesHandlers() {
  ipcMain.handle('list-downloaded-files', async (_event, folderPath) => {
    try {
      if (!fs.existsSync(folderPath)) {
        return { success: false, error: '下载文件夹不存在' };
      }

      const files = fs.readdirSync(folderPath);
      const validExts = ['.exe', '.zip', '.rar', '.7z'];
      const validFiles = files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return validExts.includes(ext);
      });

      // 获取游戏缓存数据用于匹配图片
      let gameData = [];
      try {
        const cacheDir = getCacheRootPath();
        const cacheFile = path.join(cacheDir, 'games-cache.json');
        if (fs.existsSync(cacheFile)) {
          const cacheContent = fs.readFileSync(cacheFile, 'utf-8');
          const cacheData = JSON.parse(cacheContent);
          gameData = cacheData.data || [];
        }
      } catch (cacheErr) {
        console.warn('读取游戏缓存数据失败:', cacheErr.message);
      }

      // 扫描文件并匹配图标
      const fileList = validFiles.map((file) => {
        const filePath = path.join(folderPath, file);
        const stat = fs.statSync(filePath);
        const ext = path.extname(file).toLowerCase();
        const fileNameWithoutExt = path.basename(file, path.extname(file));

        // 优先从已下载游戏图标映射中查找（使用路径匹配）
        let gameImage = downloadedGamesIconManager.findByFilePath(filePath);
        
        // 如果没有找到，再尝试从游戏缓存中匹配
        if (!gameImage) {
          const matchedGame = gameData.find((game) => {
            if (!game.name) return false;
            const normalizedName = game.name
              .toLowerCase()
              .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
            const normalizedFileName = fileNameWithoutExt
              .toLowerCase()
              .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
            return (
              normalizedFileName.includes(normalizedName) ||
              normalizedName.includes(normalizedFileName)
            );
          });
          if (matchedGame && matchedGame.img) {
            gameImage = matchedGame.img;
          }
        }

        return {
          name: file,
          path: filePath,
          size: stat.size,
          modified: stat.mtime,
          isExecutable: ext === '.exe',
          isCompressed: ['.zip', '.rar', '.7z'].includes(ext),
          image: gameImage || null,
          fileNameWithoutExt,
        };
      });

      return { success: true, files: fileList };
    } catch (err) {
      console.error('读取下载文件夹失败:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('open-folder', async (_event, folderPath) => {
    try {
      await shell.openPath(folderPath);
      return { success: true };
    } catch (err) {
      console.error('打开文件夹失败:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('launch-tool', async (_event, filePath) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (err) {
      console.error('启动工具失败:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('delete-file', async (_event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }

      // 检查文件是否在下载文件夹内（安全验证）
      let settings;
      try {
        const settingsPath = path.join(__dirname, '../../.data/settings.json');
        if (fs.existsSync(settingsPath)) {
          const settingsContent = fs.readFileSync(settingsPath, 'utf-8');
          settings = JSON.parse(settingsContent);
        }
      } catch (err) {
        console.warn('读取设置失败:', err);
      }

      if (settings && settings.downloadFolder) {
        const normalizedFilePath = path.normalize(filePath);
        const normalizedDownloadFolder = path.normalize(settings.downloadFolder);
        
        // 确保文件路径在下载文件夹内
        if (!normalizedFilePath.startsWith(normalizedDownloadFolder)) {
          return { 
            success: false, 
            error: '安全错误：只能删除下载文件夹内的文件' 
          };
        }
      }

      // 删除文件
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (err) {
      console.error('删除文件失败:', err);
      return { success: false, error: err.message };
    }
  });
}
