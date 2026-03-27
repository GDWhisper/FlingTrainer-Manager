// 游戏 IPC 处理器

import { ipcMain } from 'electron';
import { fetchHomepageGames } from '../services/crawler.js';

export function registerGamesHandlers() {
  ipcMain.handle('load-games-from-web', async (_event, forceRefresh = false) => {
    try {
      return await fetchHomepageGames(forceRefresh);
    } catch (err) {
      console.error('IPC handler error:', err);
      return { updated: false, data: [], error: '系统错误：' + err.message };
    }
  });
}
