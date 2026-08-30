// 最近更新模块

import { showToast } from './toast.js';
import { getDefaultImage, escapeHtml } from './utils.js';
import { REQUEST_LIMITS } from '../../main/constants.js';

let recentUpdatesLoaded = false;
let cachedDataHash = null; // 用于存储缓存数据的 hash
let lastRefreshTime = 0; // 上次刷新时间戳

/**
 * 生成数据的简单 hash（用于比对数据是否变化）
 * @param {Array} data - 游戏数据数组
 * @returns {string} 数据的 hash 字符串
 */
function generateDataHash(data) {
  // 使用简化的 hash 算法：拼接所有游戏的关键信息后计算
  const keyString = data
    .slice(0, 8) // 只取前 8 个游戏
    .map(game => `${game.name}|${game.downloadPageLink}`)
    .join(';');
  
  // 简单的 hash 实现
  let hash = 0;
  for (let i = 0; i < keyString.length; i++) {
    const char = keyString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * 检查是否在冷却期内
 * @returns {number|null} 返回剩余冷却秒数，如果不在冷却期则返回 null
 */
function checkCooldown() {
  const now = Date.now();
  const timeSinceLastRefresh = now - lastRefreshTime;
  
  if (timeSinceLastRefresh < REQUEST_LIMITS.REFRESH_COOLDOWN) {
    const remainingSeconds = Math.ceil((REQUEST_LIMITS.REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000);
    return remainingSeconds;
  }
  
  return null;
}

/**
 * 加载最近更新的游戏列表
 * @param {boolean} forceRefresh - 是否强制刷新
 */
export async function loadRecentUpdates(forceRefresh = false) {
  const container = document.getElementById('recent-updates-list');
  if (!container) return;

  // 如果已经加载过且不是强制刷新，则不再重复加载
  if (recentUpdatesLoaded && !forceRefresh) return;

  // 已有内容时保留原列表，加载状态由按钮特效表达；仅首次加载显示占位
  const hasContent = recentUpdatesLoaded;
  if (!hasContent) {
    container.innerHTML = '<div class="loading">正在加载最近更新...</div>';
  }

  try {
    if (typeof window.api === 'undefined') {
      if (!hasContent) container.innerHTML = '<div class="error">API 未加载</div>';
      return;
    }

    // 使用正确的 API 名称
    const result = await window.api.loadGames(forceRefresh);

    // 检查返回结果
    if (result.error) {
      // 网络失败时主进程可能带回过期缓存兜底数据，能渲染就渲染以保住列表
      if (result.data && result.data.length > 0) {
        renderIfChanged(container, result.data);
        recentUpdatesLoaded = true;
      } else if (!hasContent) {
        container.innerHTML = `
          <div class="error">${escapeHtml(result.error)}</div>
        `;
      }

      // 显示错误提示
      if (result.error.includes('次数已达上限')) {
        showToast(result.error);
      } else if (result.error.includes('网络错误')) {
        if (result.data && result.data.length > 0) {
          showToast('网络异常，已使用本地缓存数据');
        } else if (hasContent) {
          showToast('网络异常，刷新失败，已保留当前列表');
        } else {
          showToast('网络异常，请检查网络连接');
        }
      }
      return;
    }

    if (!result.data || result.data.length === 0) {
      if (hasContent) {
        showToast('未获取到更新数据，已保留当前列表');
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <p>暂无更新数据</p>
          </div>
        `;
      }
      return;
    }

    // 如果是强制刷新，比对数据是否变化
    if (forceRefresh) {
      const newHash = generateDataHash(result.data);
      if (newHash === cachedDataHash) {
        showToast('数据没有更新');
      } else {
        showToast('数据已更新');
      }
    }

    renderIfChanged(container, result.data);
    recentUpdatesLoaded = true;
  } catch (err) {
    console.error('加载最近更新失败:', err);
    if (!hasContent) {
      container.innerHTML = '<div class="error">加载最近更新失败</div>';
    }
    showToast(hasContent ? '加载失败，已保留当前列表' : '加载失败，请检查网络连接');
  }
}

/**
 * 数据未变化且列表仍在时跳过重绘，避免刷新时卡片闪烁
 * @param {HTMLElement} container - 容器元素
 * @param {Array} games - 游戏数据数组
 */
function renderIfChanged(container, games) {
  const newHash = generateDataHash(games);
  if (newHash === cachedDataHash && container.querySelector('.game-card')) {
    return;
  }
  cachedDataHash = newHash;
  renderRecentUpdates(container, games);
}

/**
 * 初始化更新按钮事件
 */
export function initRecentUpdatesRefresh() {
  const refreshBtn = document.getElementById('refresh-recent-updates-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      // is-loading 避开全局 .loading 占位符样式（padding: 40px 20px）会撑大按钮
      if (refreshBtn.classList.contains('is-loading')) return;

      // 检查冷却时间
      const cooldown = checkCooldown();
      if (cooldown) {
        showToast(`请勿频繁刷新，请等待 ${cooldown} 秒后再试`);
        return;
      }

      // 旋转动画持续到加载结束，而不是固定时长
      refreshBtn.classList.add('rotating', 'is-loading');

      try {
        await loadRecentUpdates(true);
        // 刷新成功后更新冷却时间
        lastRefreshTime = Date.now();
      } finally {
        refreshBtn.classList.remove('rotating', 'is-loading');
      }
    });
  }
}

/**
 * 渲染最近更新列表
 * @param {HTMLElement} container - 容器元素
 * @param {Array} games - 游戏数据数组
 */
function renderRecentUpdates(container, games) {
  container.innerHTML = '';

  // 只显示最新更新的 8 个游戏（可根据需要调整数量）
  const recentGames = games.slice(0, 8);

  recentGames.forEach((game) => {
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
