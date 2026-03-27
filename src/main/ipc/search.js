// 搜索 IPC 处理器

import { ipcMain } from 'electron';
import { searchGames } from '../services/crawler.js';

export function registerSearchHandlers() {
  ipcMain.handle('search-games', async (_event, keyword, forceRefresh = false) => {
    return await searchGames(keyword, forceRefresh);
  });
}
