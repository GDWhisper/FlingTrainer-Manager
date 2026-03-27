// 搜索模块 - 首页搜索

import { showToast } from './toast.js';
import { getDefaultImage, escapeHtml } from './utils.js';

/**
 * 执行搜索
 */
export async function performSearch() {
  const input = document.getElementById('game-search');
  const resultsContainer = document.getElementById('search-results');
  const wrapper = document.getElementById('search-results-container');

  if (!input || !resultsContainer || !wrapper) return;

  const query = input.value.trim();
  if (!query) {
    showToast('请输入搜索关键词');
    return;
  }

  // 显示搜索结果区域
  wrapper.classList.remove('hidden');
  resultsContainer.innerHTML = '<div class="loading">搜索中...</div>';

  try {
    if (typeof window.api === 'undefined') {
      resultsContainer.innerHTML = '<div class="error">API 未加载</div>';
      return;
    }

    const result = await window.api.searchGames(query);

    if (!result.success) {
      resultsContainer.innerHTML = `
        <div class="error">${escapeHtml(result.error || '搜索失败')}</div>
      `;
      return;
    }

    if (!result.games || result.games.length === 0) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <p>未找到与 "${escapeHtml(query)}" 相关的结果</p>
        </div>
      `;
      return;
    }

    renderSearchResults(resultsContainer, result.games);
  } catch (err) {
    console.error('搜索失败:', err);
    resultsContainer.innerHTML = '<div class="error">搜索失败</div>';
  }
}

/**
 * 清除搜索输入和结果
 */
export function clearSearchInput() {
  const input = document.getElementById('game-search');
  const resultsContainer = document.getElementById('search-results');
  const wrapper = document.getElementById('search-results-container');

  if (input) input.value = '';
  if (resultsContainer) resultsContainer.innerHTML = '';
  if (wrapper) wrapper.classList.add('hidden');
}

/**
 * 渲染搜索结果
 * @param {HTMLElement} container - 结果容器
 * @param {Array} games - 游戏数据数组
 */
function renderSearchResults(container, games) {
  container.innerHTML = '';

  games.forEach((game) => {
    const card = document.createElement('div');
    card.className = 'game-card';

    card.innerHTML = `
      <img src="${escapeHtml(game.img || getDefaultImage())}" alt="${escapeHtml(game.name)}" loading="lazy">
      <div class="info">
        <h3>${escapeHtml(game.name)}</h3>
        <div class="btn-group">
          <button class="btn detail-btn" data-action="open-detail" data-url="${escapeHtml(game.downloadPageLink)}" data-name="${escapeHtml(game.name)}">详情</button>
          <button class="btn download-btn" data-action="download" data-url="${escapeHtml(game.downloadPageLink)}" data-name="${escapeHtml(game.name)}" data-image="${escapeHtml(game.img || '')}">下载</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}
