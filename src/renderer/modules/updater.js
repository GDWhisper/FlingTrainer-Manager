// updater.js - 应用内更新模块
// 常驻监听主进程更新状态推送（区别于下载监听按页签启停）：
// 启动静默检查发现新版本时，无论用户停留在哪个页面都能收到 Toast 提示。

import { showToast } from './toast.js';
import { formatFileSize } from './utils.js';
import { showConfirmDialog } from './downloads.js';

let initialized = false;
let listenerActive = false;
let unsubscribeState = null;
let lastState = null;
let currentSnapshot = null;

/**
 * 初始化更新模块（DOMContentLoaded 时调用一次）
 */
export function initUpdater() {
  if (initialized) return;
  initialized = true;

  bindStaticEvents();

  if (typeof window.api === 'undefined') return;

  // 回放当前状态（主进程启动静默检查可能已完成）
  rehydrate();

  // 常驻订阅状态推送
  window.api.startUpdateListener();
  unsubscribeState = window.api.onUpdateStateChanged((snapshot) => {
    render(snapshot);
  });
  listenerActive = true;

  // 窗口关闭时清理推送监听（三重防护之一）
  window.addEventListener('beforeunload', () => {
    if (unsubscribeState) {
      unsubscribeState();
      unsubscribeState = null;
    }
    if (listenerActive && typeof window.api !== 'undefined') {
      window.api.stopUpdateListener();
      listenerActive = false;
    }
  });
}

async function rehydrate() {
  try {
    const result = await window.api.getUpdateState();
    if (result?.success && result.update) {
      render(result.update);
    }
  } catch (err) {
    console.error('获取更新状态失败:', err);
  }
}

function bindStaticEvents() {
  const checkBtn = document.getElementById('check-update-btn');
  const checkStatus = document.getElementById('update-check-status');

  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      if (typeof window.api === 'undefined') return;
      checkBtn.disabled = true;
      if (checkStatus) checkStatus.textContent = '正在检查…';

      try {
        const result = await window.api.checkForUpdates();
        if (result?.devMode) {
          if (checkStatus) checkStatus.textContent = '开发环境不检查更新';
          return;
        }
        if (!result?.success) {
          if (checkStatus) checkStatus.textContent = result?.error || '检查更新失败';
          showToast(result?.error || '检查更新失败');
          return;
        }
        // 成功路径的界面更新由状态推送驱动（render）
        if (checkStatus && result.update) {
          checkStatus.textContent =
            result.update.state === 'not-available' ? '已是最新版本' : '发现新版本';
        }
      } catch (err) {
        console.error('检查更新失败:', err);
        if (checkStatus) checkStatus.textContent = '检查更新失败';
        showToast('检查更新失败：' + err.message);
      } finally {
        checkBtn.disabled = false;
      }
    });
  }

  // 更新操作按钮（事件委托，按钮随状态重绘）
  const actionsEl = document.getElementById('update-actions');
  if (actionsEl) {
    actionsEl.addEventListener('click', handleActionClick);
  }

  // 查看更新内容：系统浏览器打开 Releases 页
  const releaseLink = document.getElementById('update-release-link');
  if (releaseLink) {
    releaseLink.addEventListener('click', (e) => {
      e.preventDefault();
      openReleasePage();
    });
  }
}

async function handleActionClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn || typeof window.api === 'undefined') return;
  const action = btn.dataset.action;

  try {
    switch (action) {
      case 'update-download':
      case 'update-resume':
      case 'update-retry': {
        const result = await window.api.downloadUpdate();
        if (!result?.success) showToast(result?.error || '操作失败');
        break;
      }

      case 'update-pause': {
        const result = await window.api.pauseUpdateDownload();
        if (!result?.success) showToast(result?.error || '暂停失败');
        break;
      }

      case 'update-stop': {
        const partial = currentSnapshot?.partialSize || 0;
        if (partial > 0) {
          const ok = await showConfirmDialog(
            `停止下载将删除已下载的 ${formatFileSize(partial)}，确定停止吗？`,
            '停止下载'
          );
          if (!ok) return;
        }
        const result = await window.api.cancelUpdateDownload();
        if (!result?.success) showToast(result?.error || '停止失败');
        break;
      }

      case 'update-install': {
        const version = currentSnapshot?.latestVersion || '';
        const ok = await showConfirmDialog(
          `即将退出应用并静默安装新版本 ${version ? 'v' + version : ''}，安装完成后请重新启动。\n\n确定继续吗？`,
          '确认安装'
        );
        if (!ok) return;
        const result = await window.api.installUpdate();
        if (!result?.success) showToast(result?.error || '安装失败');
        break;
      }

      case 'update-goto-page': {
        openReleasePage();
        break;
      }
    }
  } catch (err) {
    console.error('更新操作失败:', err);
    showToast('更新操作失败：' + err.message);
  }
}

function openReleasePage() {
  const url = currentSnapshot?.releasePageUrl;
  if (!url || typeof window.api === 'undefined') return;
  window.api.openExternalLink(url);
  showToast('正在使用默认浏览器打开下载页');
}

/**
 * 依据状态快照重绘更新卡片（所有外部字符串经 textContent 写入，避免注入）
 */
function render(snapshot) {
  if (!snapshot) return;
  currentSnapshot = snapshot;

  // 当前版本号（设置页）
  const currentVersionEl = document.getElementById('update-current-version');
  if (currentVersionEl) currentVersionEl.textContent = `v${snapshot.currentVersion}`;

  // 关于页版本号（若已渲染）
  const aboutVersionEl = document.getElementById('about-version');
  if (aboutVersionEl) aboutVersionEl.textContent = `v${snapshot.currentVersion}`;

  const card = document.getElementById('update-card');
  if (!card) return;

  // 卡片可见状态：已发现更新后的所有阶段；error 无清单时（检查失败）不显示卡片
  const hasManifest = !!snapshot.latestVersion;
  const cardVisible =
    hasManifest &&
    ['available', 'downloading', 'paused', 'verifying', 'downloaded', 'installing', 'error'].includes(
      snapshot.state
    );
  card.classList.toggle('hidden', !cardVisible);
  if (!cardVisible) return;

  // 头部：新版本号与发布日期
  const latestVersionEl = document.getElementById('update-latest-version');
  if (latestVersionEl) latestVersionEl.textContent = `新版本 v${snapshot.latestVersion}`;

  const releaseDateEl = document.getElementById('update-release-date');
  if (releaseDateEl) {
    releaseDateEl.textContent = snapshot.releaseDate
      ? new Date(snapshot.releaseDate).toLocaleDateString('zh-CN')
      : '';
  }

  // 状态说明
  const statusText = document.getElementById('update-status-text');
  const errorText = document.getElementById('update-error-text');
  let statusMsg = '';
  let errorMsg = '';
  switch (snapshot.state) {
    case 'available':
      statusMsg = snapshot.isPortable
        ? '便携版暂不支持应用内更新，请前往下载页手动下载新版本。'
        : '发现新版本，可下载更新。';
      break;
    case 'downloading':
      statusMsg = '正在下载更新…';
      break;
    case 'paused':
      statusMsg = '已暂停，已下载部分会保留，可随时继续。';
      break;
    case 'verifying':
      statusMsg = '正在校验安装包完整性…';
      break;
    case 'downloaded':
      statusMsg = '更新包已就绪，可立即安装。';
      break;
    case 'installing':
      statusMsg = '正在启动安装器，应用即将退出…';
      break;
    case 'error':
      errorMsg = snapshot.errorMessage || '更新流程出现错误';
      break;
  }
  if (statusText) statusText.textContent = statusMsg;
  if (errorText) errorText.textContent = errorMsg;

  // 进度条与进度信息
  const progressBar = card.querySelector('.update-progress-bar');
  const progressFill = document.getElementById('update-progress-fill');
  const progressInfo = document.getElementById('update-progress-info');
  const showProgress = ['downloading', 'paused', 'verifying', 'downloaded'].includes(snapshot.state);
  if (progressBar) progressBar.classList.toggle('hidden', !showProgress);

  if (progressFill) progressFill.style.width = `${snapshot.progress.percent || 0}%`;

  if (progressInfo) {
    if (!showProgress) {
      progressInfo.textContent = '';
    } else {
      const { downloadedSize, fileSize, speed } = snapshot.progress;
      let info = fileSize
        ? `${formatFileSize(downloadedSize)} / ${formatFileSize(fileSize)}`
        : formatFileSize(downloadedSize);
      if (snapshot.state === 'downloading' && speed) {
        info += ` · ${formatFileSize(speed)}/s`;
      }
      progressInfo.textContent = info;
    }
  }

  // 操作按钮组（随状态重绘）
  const actionsEl = document.getElementById('update-actions');
  if (actionsEl) renderActions(actionsEl, snapshot);

  // 状态迁移提示：进入 available 时 Toast（含启动静默检查的结果）
  if (snapshot.state === 'available' && lastState && lastState !== 'available') {
    showToast(`发现新版本 v${snapshot.latestVersion}`);
  }
  lastState = snapshot.state;
}

function renderActions(container, snapshot) {
  const buttons = [];
  const gotoPageBtn = {
    action: 'update-goto-page',
    label: '前往下载页',
    className: 'btn-retry',
  };

  switch (snapshot.state) {
    case 'available':
      if (snapshot.isPortable) {
        buttons.push(gotoPageBtn);
      } else {
        buttons.push({ action: 'update-download', label: '下载更新', className: 'btn-retry' });
      }
      break;
    case 'downloading':
      buttons.push({ action: 'update-pause', label: '暂停', className: 'btn-cancel' });
      buttons.push({ action: 'update-stop', label: '停止', className: 'btn-danger' });
      break;
    case 'paused':
      buttons.push({ action: 'update-resume', label: '继续', className: 'btn-retry' });
      buttons.push({ action: 'update-stop', label: '停止', className: 'btn-danger' });
      break;
    case 'error':
      // 下载/校验阶段失败：重试（断点续传）；同时提供手动下载兜底
      buttons.push({ action: 'update-retry', label: '重试', className: 'btn-retry' });
      buttons.push(gotoPageBtn);
      break;
    case 'downloaded':
      if (!snapshot.isPortable) {
        buttons.push({ action: 'update-install', label: '立即安装', className: 'btn-open' });
      }
      break;
    default:
      break;
  }

  container.innerHTML = buttons
    .map(
      (b) =>
        `<button class="btn ${b.className}" data-action="${b.action}">${b.label}</button>`
    )
    .join('');
}
