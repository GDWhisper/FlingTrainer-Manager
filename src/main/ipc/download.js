// 下载 IPC 处理器

import { ipcMain } from 'electron';
import { getDownloadInfo, downloadManager } from '../services/downloader.js';

export function registerDownloadHandlers() {
  // 获取下载信息
  ipcMain.handle(
    'get-download-info',
    async (_event, downloadPageUrl, gameName) => {
      const result = await getDownloadInfo(downloadPageUrl);
      // 优先使用调用方传入的游戏名
      if (gameName && gameName !== '未知游戏') {
        result.gameName = gameName;
      }
      return result;
    }
  );

  // 添加到下载队列
  ipcMain.handle(
    'add-download-task',
    async (_event, taskInfo) => {
      try {
        const taskId = downloadManager.addTask(taskInfo);
        return { success: true, taskId };
      } catch (err) {
        console.error('添加下载任务失败:', err);
        return { success: false, error: err.message };
      }
    }
  );

  // 取消下载任务
  ipcMain.handle('cancel-download-task', async (_event, taskId) => {
    try {
      const success = downloadManager.cancelTask(taskId);
      return { success };
    } catch (err) {
      console.error('取消下载任务失败:', err);
      return { success: false, error: err.message };
    }
  });

  // 移除单个下载任务（包括记录）
  ipcMain.handle('remove-download-task', async (_event, taskId) => {
    try {
      const success = downloadManager.removeTask(taskId);
      return { success };
    } catch (err) {
      console.error('移除下载任务失败:', err);
      return { success: false, error: err.message };
    }
  });

  // 获取所有下载任务
  ipcMain.handle('get-all-download-tasks', async () => {
    try {
      const tasks = downloadManager.getAllTasks();
      return { success: true, tasks };
    } catch (err) {
      console.error('获取下载任务失败:', err);
      return { success: false, error: err.message };
    }
  });

  // 清除所有非下载中的任务（批量清除）
  ipcMain.handle('clear-all-download-tasks', async () => {
    try {
      downloadManager.clearAllNonDownloadingTasks();
      return { success: true };
    } catch (err) {
      console.error('清除所有任务失败:', err);
      return { success: false, error: err.message };
    }
  });

  // 显示确认对话框
  ipcMain.handle('show-confirm-dialog', async (event, options) => {
    return new Promise((resolve) => {
      // 将结果发送回渲染进程
      event.sender.send('confirm-dialog-response', options.id, true);
      resolve({ confirmed: true });
    });
  });

  // 监听下载状态变化（通过轮询）
  let statusListenerInterval = null;
  
  ipcMain.handle('start-download-listener', async (event) => {
    if (statusListenerInterval) {
      clearInterval(statusListenerInterval);
    }

    statusListenerInterval = setInterval(() => {
      const tasks = downloadManager.getAllTasks();
      event.sender.send('download-status-changed', { tasks });
    }, 1000); // 每秒推送一次状态

    return { success: true };
  });

  ipcMain.handle('stop-download-listener', async () => {
    if (statusListenerInterval) {
      clearInterval(statusListenerInterval);
      statusListenerInterval = null;
    }
    return { success: true };
  });
}
