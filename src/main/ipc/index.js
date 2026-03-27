// IPC 处理器注册入口

import { registerGamesHandlers } from './games.js';
import { registerSearchHandlers } from './search.js';
import { registerDownloadHandlers } from './download.js';
import { registerSettingsHandlers } from './settings.js';
import { registerFilesHandlers } from './files.js';
import { registerWindowHandlers } from './window.js';

export function registerAllIpcHandlers() {
  registerGamesHandlers();
  registerSearchHandlers();
  registerDownloadHandlers();
  registerSettingsHandlers();
  registerFilesHandlers();
  registerWindowHandlers();
}
