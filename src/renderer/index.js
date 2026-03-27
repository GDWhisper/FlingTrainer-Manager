// renderer/index.js - 入口文件
// 负责初始化、事件委托和模块协调

import { showToast } from './modules/toast.js';
import { navigateTo, showTab } from './modules/navigation.js';
import { loadAllGames } from './modules/games.js';
import { downloadGame, loadDownloadedFiles, showConfirmDialog, initDownloadedListEvents } from './modules/downloads.js';
import { initSettings } from './modules/settings.js';
import { generateWelcomeContent, generateAboutContent } from './modules/pages.js';
import { loadRecentUpdates, initRecentUpdatesRefresh } from './modules/recentUpdates.js';
import { performSearchAllGames, clearSearchInputAllGames, initSearchPage } from './modules/searchAllGames.js';

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 加载完成');

  if (typeof window.api === 'undefined') {
    console.error('预加载脚本未正确加载，API 未定义');
    showToast('警告：部分功能可能无法正常工作');
  }

  // 生成静态页面内容
  generateWelcomeContent();
  generateAboutContent();

  // 初始化设置页面
  initSettings();

  // 初始化搜索页面（绑定回车键）
  initSearchPage();

  // 首页默认加载最近更新
  loadRecentUpdates();

  // 初始化更新按钮
  initRecentUpdatesRefresh();

  // 初始化窗口控制按钮
  initWindowControls();

  // 初始化已下载列表事件
  initDownloadedListEvents();
});

/**
 * 初始化窗口控制按钮
 */
function initWindowControls() {
  if (typeof window.api !== 'undefined') {
    const minimizeBtn = document.getElementById('minimize-btn');
    const maximizeBtn = document.getElementById('maximize-btn');
    const closeBtn = document.getElementById('close-btn');

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        window.api.minimizeWindow();
      });
    }

    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', () => {
        window.api.maximizeWindow();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.api.closeWindow();
      });
    }
  }
}

// ========== 事件委托 ==========

// 统一的点击事件委托
document.addEventListener('click', (e) => {
  const target = e.target;

  // 导航链接
  if (target.classList.contains('nav-link')) {
    e.preventDefault();
    const page = target.dataset.page;
    if (page) navigateTo(page);
    return;
  }

  // 页签按钮
  if (target.classList.contains('tab-btn')) {
    const tab = target.dataset.tab;
    if (tab) showTab(tab);
    return;
  }

  // 所有游戏页面搜索按钮
  if (target.id === 'all-games-search-btn') {
    performSearchAllGames();
    return;
  }

  // 所有游戏页面清除搜索
  if (target.id === 'all-games-clear-search') {
    clearSearchInputAllGames();
    return;
  }

  // 游戏卡片操作按钮（事件委托）
  const actionBtn = target.closest('[data-action]');
  if (actionBtn) {
    const action = actionBtn.dataset.action;
    const url = actionBtn.dataset.url;
    const name = actionBtn.dataset.name;
    const filePath = actionBtn.dataset.path;
    const folder = actionBtn.dataset.folder;
    const image = actionBtn.dataset.image; // 新增：获取游戏图标

    switch (action) {
      case 'download':
        downloadGame(url, name, image); // 传递图标信息
        break;
      case 'open-detail':
        openDetailPage(url, name);
        break;
      case 'launch':
        launchTool(filePath);
        break;
      case 'open-folder':
        openDownloadFolder(folder);
        break;
      case 'go-settings':
        navigateTo('settings');
        break;
      default:
        break;
    }
  }
});

// 监听删除文件自定义事件
document.addEventListener('delete-file-action', (e) => {
  const { path, name } = e.detail;
  handleDeleteFile(path, name);
});

// ========== 辅助函数 ==========

/**
 * 打开详情页
 */
function openDetailPage(url, name) {
  if (!url || url === '#' || url === 'undefined') {
    showToast('链接无效');
    return;
  }

  try {
    if (typeof window.api !== 'undefined' && window.api.openExternalLink) {
      window.api.openExternalLink(url);
      showToast(`正在使用默认浏览器打开 ${name} 的 Trainer 下载页面`);
    }
  } catch (err) {
    console.error('打开详情页失败:', err);
    showToast('打开详情页失败');
  }
}

/**
 * 打开下载文件夹
 */
function openDownloadFolder(folderPath) {
  if (typeof window.api !== 'undefined' && window.api.openFolder) {
    window.api.openFolder(folderPath);
  }
}

/**
 * 启动工具
 */
async function launchTool(filePath) {
  try {
    if (typeof window.api === 'undefined') return;
    const result = await window.api.launchTool(filePath);
    if (result.success) {
      showToast('正在启动工具...');
    } else {
      showToast('启动工具失败：' + result.error);
    }
  } catch (err) {
    console.error('启动工具失败:', err);
    showToast('启动工具失败：' + err.message);
  }
}

/**
 * 处理删除文件操作
 */
async function handleDeleteFile(filePath, fileName) {
  if (!filePath || !fileName) {
    showToast('文件路径无效');
    return;
  }

  // 显示自定义确认对话框
  const confirmed = await showConfirmDialog(
    `确定要删除 "${fileName}" 吗？\n\n警告：此操作不可逆转，文件将被永久删除！`,
    '确认删除'
  );

  if (!confirmed) return;

  try {
    if (typeof window.api === 'undefined') {
      showToast('API 未加载');
      return;
    }

    const result = await window.api.deleteFile(filePath);

    if (result.success) {
      showToast('文件已删除');
      // 重新加载已下载列表
      await loadDownloadedFiles();
    } else {
      showToast('删除失败：' + result.error);
    }
  } catch (err) {
    console.error('删除文件失败:', err);
    showToast('删除失败：' + err.message);
  }
}
