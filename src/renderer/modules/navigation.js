// 页面和页签导航

import { loadAllGames } from './games.js';
import { loadDownloadedFiles, initDownloadList, stopDownloadListener } from './downloads.js';
import { loadRecentUpdates } from './recentUpdates.js';

let downloadedPageLoaded = false;
let downloadingPageInitialized = false;

/**
 * 切换到指定页面
 * @param {string} pageId - 页面 ID
 */
export function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach((page) => page.classList.add('hidden'));
  const targetPage = document.getElementById(pageId);
  if (targetPage) targetPage.classList.remove('hidden');

  // 切换到修改器页面时，默认显示"已下载"页签并重置加载状态
  if (pageId === 'cheats') {
    showTab('downloaded');
    downloadedPageLoaded = false;
    downloadingPageInitialized = false;
  }

  // 切换到搜索页面时，自动聚焦到搜索框
  if (pageId === 'all-games') {
    const searchInput = document.getElementById('all-games-search');
    if (searchInput) searchInput.focus();
  }

  // 切换到首页时，加载最近更新
  if (pageId === 'home') {
    loadRecentUpdates();
  }
  
  // 离开修改器页面时，停止下载监听
  if (pageId !== 'cheats' && downloadingPageInitialized) {
    stopDownloadListener();
    downloadingPageInitialized = false;
  }
}

/**
 * 切换页签
 * @param {string} tabId - 页签 ID
 */
export function showTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
  const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
  if (tabBtn) tabBtn.classList.add('active');

  document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.add('hidden'));
  const tabPane = document.getElementById(tabId);
  if (tabPane) tabPane.classList.remove('hidden');

  // 首次切换到"已下载"页签时加载文件列表
  if (tabId === 'downloaded' && !downloadedPageLoaded) {
    loadDownloadedFiles();
    downloadedPageLoaded = true;
  }
  
  // 切换到"下载列表"页签时初始化
  if (tabId === 'downloading' && !downloadingPageInitialized) {
    initDownloadList();
    downloadingPageInitialized = true;
  }
}
