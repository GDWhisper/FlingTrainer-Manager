// 设置 IPC 处理器

import { app, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';

/**
 * 获取应用数据目录路径（绿色便携化）
 */
function getAppDataPath() {
  // 开发环境
  if (process.env.NODE_ENV === 'development') {
    const devPath = path.join(__dirname, '../../.data');
    if (!fs.existsSync(devPath)) {
      fs.mkdirSync(devPath, { recursive: true });
    }
    return devPath;
  }
  
  // 生产环境：使用可执行文件所在目录
  try {
    const exeDir = path.dirname(process.execPath);
    const appDataDir = path.join(exeDir, 'FlingTrainer-Manager-Data');
    
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
    console.error('获取应用路径失败:', err.message);
    return path.join(app.getPath('userData'), 'FlingTrainer-Manager');
  }
}

const settingsFile = path.join(getAppDataPath(), 'settings.json');

export function registerSettingsHandlers() {
  ipcMain.handle('load-settings', async () => {
    try {
      if (fs.existsSync(settingsFile)) {
        return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      }
      return {};
    } catch (err) {
      console.error('加载设置失败:', err);
      return {};
    }
  });

  ipcMain.handle('save-settings', async (_event, settings) => {
    try {
      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
      return { success: true };
    } catch (err) {
      console.error('保存设置失败:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });
}
