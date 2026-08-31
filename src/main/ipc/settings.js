// 设置 IPC 处理器

import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { getAppDataDirectory } from '../utils/cache.js';

// 惰性求值：首次调用时才解析路径，确保 cache.js 的一次性迁移已生效
function settingsFile() {
  return path.join(getAppDataDirectory(), 'settings.json');
}

/**
 * 同步读取设置（供主进程启动流程使用，如启动静默检查更新）
 */
export function loadSettingsSync() {
  try {
    const file = settingsFile();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error('加载设置失败:', err);
  }
  return {};
}

export function registerSettingsHandlers() {
  ipcMain.handle('load-settings', async () => {
    return loadSettingsSync();
  });

  ipcMain.handle('save-settings', async (_event, settings) => {
    try {
      // 补丁合并写：只更新传入的键，避免覆盖其他设置项
      const merged = { ...loadSettingsSync(), ...(settings || {}) };
      fs.writeFileSync(settingsFile(), JSON.stringify(merged, null, 2));
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
