// 游戏列表模块

import { showToast } from './toast.js';
import { getDefaultImage, escapeHtml } from './utils.js';

let gamesLoaded = false;

/**
 * 加载所有游戏
 */
export async function loadAllGames() {
  const container = document.getElementById('games-container');
  if (!container) return;

  if (gamesLoaded) return;

  container.innerHTML = '<div class="loading">正在加载游戏列表...</div>';

  try {
    if (typeof window.api === 'undefined') {
      container.innerHTML = '<div class="error">API 未加载</div>';
      return;
    }

    const result = await window.api.loadGamesFromWeb();

    if (!result.success) {
      container.innerHTML = `
        <div class="error">${escapeHtml(result.error || '加载失败')}</div>
      `;
      return;
    }

    if (!result.data || result.data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>暂无游戏数据</p>
        </div>
      `;
      return;
    }

    renderGames(container, result.data);
    gamesLoaded = true;
  } catch (err) {
    console.error('加载游戏列表失败:', err);
    container.innerHTML = '<div class="error">加载游戏列表失败</div>';
  }
}

/**
 * 渲染游戏卡片列表
 * @param {HTMLElement} container - 容器元素
 * @param {Array} games - 游戏数据数组
 */
function renderGames(container, games) {
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
