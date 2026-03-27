// downloads.js - 下载管理模块

import { navigateTo } from './navigation.js';
import { showToast } from './toast.js';
import { formatFileSize, formatDate, getDefaultImage, escapeHtml } from './utils.js';

// 下载任务列表
let downloadTasks = [];
let downloadListenerActive = false;

/**
 * 初始化已下载列表的事件委托（更多按钮）
 */
export function initDownloadedListEvents() {
  // 处理更多按钮点击事件（事件委托）
  document.addEventListener('click', (e) => {
    const target = e.target;

    // 点击更多按钮，切换菜单显示
    if (target.classList.contains('btn-more')) {
      e.stopPropagation();
      const wrapper = target.closest('.more-actions-wrapper');
      if (wrapper) {
        const menu = wrapper.querySelector('.more-actions-menu');
        if (menu) {
          // 关闭其他所有打开的菜单
          document.querySelectorAll('.more-actions-menu.show').forEach((m) => {
            if (m !== menu) m.classList.remove('show');
          });
          // 切换当前菜单
          menu.classList.toggle('show');
        }
      }
      return;
    }

    // 点击菜单项时触发删除动作
    if (target.classList.contains('more-menu-item')) {
      e.stopPropagation();
      const action = target.dataset.action;
      const path = target.dataset.path;
      const name = target.dataset.name;

      // 将事件冒泡到全局事件委托处理
      const fakeBtn = document.createElement('button');
      fakeBtn.dataset.action = action;
      fakeBtn.dataset.path = path;
      fakeBtn.dataset.name = name;
      fakeBtn.style.display = 'none';
      target.appendChild(fakeBtn);
      
      // 触发自定义事件
      const event = new CustomEvent('delete-file-action', {
        detail: { path, name }
      });
      document.dispatchEvent(event);
      
      // 关闭菜单
      const menu = target.closest('.more-actions-menu');
      if (menu) menu.classList.remove('show');
      return;
    }

    // 点击其他地方关闭所有菜单
    document.querySelectorAll('.more-actions-menu.show').forEach((menu) => {
      menu.classList.remove('show');
    });
  });
}

/**
 * 显示自定义确认对话框
 * @param {string} message - 确认信息
 * @param {string} title - 对话框标题
 * @returns {Promise<boolean>} - 用户是否确认
 */
export function showConfirmDialog(message, title = '确认操作') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-dialog-overlay');
    const messageEl = document.getElementById('confirm-dialog-message');
    const titleEl = document.getElementById('confirm-dialog-title');
    const cancelBtn = document.getElementById('confirm-dialog-cancel');
    const confirmBtn = document.getElementById('confirm-dialog-confirm');

    // 设置内容
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    // 显示对话框
    if (overlay) overlay.classList.remove('hidden');

    // 绑定取消按钮事件
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    // 绑定确认按钮事件
    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    // 清理函数
    const cleanup = () => {
      if (overlay) overlay.classList.add('hidden');
      if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
      if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
    };

    // 绑定事件
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);

    // 点击遮罩层关闭
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(false);
        }
      }, { once: true });
    }
  });
}

/**
 * 格式化下载速度
 * @param {number} bytesPerSecond - 字节/秒
 * @returns {string} 格式化后的速度字符串
 */
function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond === 0) return '';
  
  const mbps = bytesPerSecond / (1024 * 1024);
  const kbps = bytesPerSecond / 1024;
  
  if (mbps >= 1) {
    return `${mbps.toFixed(2)} MB/s`;
  } else if (kbps >= 1) {
    return `${kbps.toFixed(0)} KB/s`;
  } else {
    return `${bytesPerSecond.toFixed(0)} B/s`;
  }
}

/**
 * 获取状态文本
 * @param {string} status - 状态码
 * @returns {string} 状态文本
 */
function getStatusText(status) {
  const statusMap = {
    'queued': '准备下载',
    'downloading': '下载中',
    'completed': '已下载',
    'cancelled': '已取消',
    'failed': '下载失败'
  };
  return statusMap[status] || status;
}

/**
 * 获取状态样式类
 * @param {string} status - 状态码
 * @returns {string} CSS 类名
 */
function getStatusClass(status) {
  const classMap = {
    'queued': 'status-queued',
    'downloading': 'status-downloading',
    'completed': 'status-completed',
    'cancelled': 'status-cancelled',
    'failed': 'status-failed'
  };
  return classMap[status] || '';
}

/**
 * 下载游戏（使用新的下载管理器）
 * @param {string} downloadPageUrl - 下载页面链接
 * @param {string} gameName - 游戏名称
 * @param {string} gameImage - 游戏图标（可选）
 */
export async function downloadGame(downloadPageUrl, gameName, gameImage) {
  if (!downloadPageUrl || downloadPageUrl === '#' || downloadPageUrl === 'undefined') {
    showToast('下载链接无效');
    return;
  }

  // 检查下载文件夹设置
  let settings = {};
  try {
    if (typeof window.api !== 'undefined') {
      settings = await window.api.loadSettings();
    }
  } catch (e) {
    console.error('加载设置失败:', e);
  }

  if (!settings.downloadFolder) {
    showToast('请先在设置中配置下载文件夹');
    navigateTo('settings');
    return;
  }

  try {
    // 获取下载信息
    const info = await window.api.getDownloadInfo(downloadPageUrl, gameName);

    if (info.error && !info.downloadLink) {
      showToast(info.error);
      return;
    }

    // 添加到下载队列，传递游戏图标
    const taskInfo = {
      gameName: info.gameName || gameName,
      downloadUrl: info.downloadLink,
      gameImage: gameImage || null, // 新增：游戏图标
      folder: settings.downloadFolder
    };

    const result = await window.api.addDownloadTask(taskInfo);

    if (result.success) {
      showToast(`已添加到下载队列：${taskInfo.gameName}`);
    } else {
      showToast('添加任务失败：' + (result.error || '未知错误'));
    }
  } catch (err) {
    console.error('下载过程出错:', err);
    showToast('下载失败：' + err.message);
  }
}

/**
 * 初始化下载列表页签
 */
export function initDownloadList() {
  // 启动下载监听
  if (!downloadListenerActive && typeof window.api !== 'undefined') {
    window.api.startDownloadListener();
    
    window.api.onDownloadStatusChanged((data) => {
      if (data.tasks) {
        downloadTasks = data.tasks;
        renderDownloadList();
      }
    });
    
    downloadListenerActive = true;
  }
  
  // 绑定移除全部记录按钮事件
  const clearAllBtn = document.getElementById('clear-all-tasks-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      // 显示自定义确认对话框
      const confirmed = await showConfirmDialog(
        '该操作将会移除所有下载记录，不影响实际已下载的工具\n\n确定要继续吗？',
        '确认移除'
      );
      
      if (!confirmed) return;
      
      try {
        const result = await window.api.clearAllDownloadTasks();
        if (result.success) {
          showToast('已移除所有下载记录');
          // 重新加载任务列表
          loadDownloadTasks();
        } else {
          showToast('清除失败：' + result.error);
        }
      } catch (err) {
        console.error('批量清除失败:', err);
        showToast('批量清除失败：' + err.message);
      }
    });
  }
  
  // 初始加载
  loadDownloadTasks();
}

/**
 * 停止下载监听
 */
export function stopDownloadListener() {
  if (downloadListenerActive && typeof window.api !== 'undefined') {
    window.api.stopDownloadListener();
    downloadListenerActive = false;
  }
}

/**
 * 加载下载任务列表
 */
export async function loadDownloadTasks() {
  if (typeof window.api === 'undefined') return;
  
  try {
    const result = await window.api.getAllDownloadTasks();
    if (result.success && result.tasks) {
      downloadTasks = result.tasks;
      renderDownloadList();
    }
  } catch (err) {
    console.error('加载下载任务失败:', err);
  }
}

/**
 * 渲染下载列表
 */
function renderDownloadList() {
  const container = document.getElementById('download-tasks-list');
  if (!container) return;

  // 获取移除全部记录按钮
  const clearAllBtn = document.getElementById('clear-all-tasks-btn');

  if (!downloadTasks || downloadTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无下载任务</p>
        <p>去"首页"或"搜索"页面添加下载任务</p>
      </div>
    `;
    updateDownloadStats();
    
    // 禁用移除全部记录按钮
    if (clearAllBtn) {
      clearAllBtn.disabled = true;
      clearAllBtn.classList.add('disabled');
    }
    return;
  }

  // 有任务时启用按钮
  if (clearAllBtn) {
    clearAllBtn.disabled = false;
    clearAllBtn.classList.remove('disabled');
  }

  // 倒序排列：最新的任务显示在最上方（按开始时间倒序）
  const sortedTasks = [...downloadTasks].sort((a, b) => {
    // 如果两个任务都有开始时间，按时间倒序
    if (a.startTime && b.startTime) {
      return b.startTime - a.startTime;
    }
    // 如果一个有开始时间，一个没有，有时间的在前
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    // 都没有开始时间，保持原顺序
    return 0;
  });

  container.innerHTML = '';

  sortedTasks.forEach(task => {
    const item = document.createElement('div');
    item.className = `download-task-item ${getStatusClass(task.status)}`;

    const speedText = formatSpeed(task.speed);
    const progressText = task.progress ? `${task.progress.toFixed(1)}%` : '';
    const sizeText = task.fileSize 
      ? `${formatFileSize(task.downloadedSize)} / ${formatFileSize(task.fileSize)}`
      : formatFileSize(task.downloadedSize);
    
    const timeInfo = task.startTime 
      ? new Date(task.startTime).toLocaleString('zh-CN')
      : '';

    item.innerHTML = `
      <div class="task-header">
        <span class="task-name">${escapeHtml(task.gameName)}</span>
        <span class="task-status ${getStatusClass(task.status)}">${getStatusText(task.status)}</span>
      </div>
      <div class="task-progress-bar">
        <div class="task-progress-fill" style="width: ${task.progress || 0}%"></div>
      </div>
      <div class="task-info-grid">
        <div class="task-info-item">
          <span class="label">进度:</span>
          <span class="value">${progressText}</span>
        </div>
        <div class="task-info-item">
          <span class="label">大小:</span>
          <span class="value">${sizeText}</span>
        </div>
        ${speedText ? `
        <div class="task-info-item">
          <span class="label">速度:</span>
          <span class="value speed">${speedText}</span>
        </div>
        ` : ''}
        ${task.errorMessage ? `
        <div class="task-info-item error">
          <span class="label">错误:</span>
          <span class="value">${escapeHtml(task.errorMessage)}</span>
        </div>
        ` : ''}
        <div class="task-info-item">
          <span class="label">时间:</span>
          <span class="value">${timeInfo}</span>
        </div>
      </div>
      <div class="task-actions">
        ${task.status === 'downloading' || task.status === 'queued' ? `
          <button class="btn btn-cancel" data-action="cancel" data-task-id="${task.id}">取消下载</button>
        ` : ''}
        ${task.status === 'completed' ? `
          <button class="btn btn-open" data-action="open-folder" data-path="${escapeHtml(task.filePath)}">打开文件位置</button>
          <button class="btn btn-danger" data-action="remove" data-task-id="${task.id}">移除记录</button>
        ` : ''}
        ${task.status === 'failed' || task.status === 'cancelled' ? `
          <button class="btn btn-retry" data-action="retry" data-task='${escapeHtml(JSON.stringify(task))}'>重新下载</button>
          <button class="btn btn-danger" data-action="remove" data-task-id="${task.id}">移除记录</button>
        ` : ''}
      </div>
    `;

    container.appendChild(item);
  });

  // 绑定事件
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      const taskId = e.target.dataset.taskId;
      const taskData = e.target.dataset.task;
      const path = e.target.dataset.path;

      switch (action) {
        case 'cancel':
          if (taskId) {
            const result = await window.api.cancelDownloadTask(taskId);
            if (result.success) {
              showToast('已取消下载');
            }
          }
          break;
        
        case 'remove':
          if (taskId) {
            const result = await window.api.removeDownloadTask(taskId);
            if (result.success) {
              showToast('已移除记录');
            } else {
              showToast('移除失败：' + result.error);
            }
          }
          break;
        
        case 'open-folder':
          if (path) {
            const folder = path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
            await window.api.openFolder(folder);
          }
          break;
        
        case 'retry':
          if (taskData) {
            try {
              const task = JSON.parse(taskData);
              const settings = await window.api.loadSettings();
              if (settings.downloadFolder) {
                const taskInfo = {
                  gameName: task.gameName,
                  downloadUrl: task.downloadUrl,
                  folder: settings.downloadFolder
                };
                const result = await window.api.addDownloadTask(taskInfo);
                if (result.success) {
                  showToast('已重新添加到下载队列');
                } else {
                  showToast('重试失败：' + result.error);
                }
              } else {
                showToast('请先配置下载文件夹');
              }
            } catch (err) {
              showToast('重试失败：' + err.message);
            }
          }
          break;
      }
    });
  });

  // 更新统计信息
  updateDownloadStats();
}

/**
 * 更新下载统计信息
 */
function updateDownloadStats() {
  const statsEl = document.getElementById('download-stats-text');
  if (!statsEl) return;

  if (!downloadTasks || downloadTasks.length === 0) {
    statsEl.textContent = '暂无任务';
    return;
  }

  const stats = {
    total: downloadTasks.length,
    downloading: downloadTasks.filter(t => t.status === 'downloading').length,
    queued: downloadTasks.filter(t => t.status === 'queued').length,
    completed: downloadTasks.filter(t => t.status === 'completed').length,
    failed: downloadTasks.filter(t => t.status === 'failed').length,
    cancelled: downloadTasks.filter(t => t.status === 'cancelled').length
  };

  statsEl.textContent = `共 ${stats.total} 个任务 | 下载中：${stats.downloading} | 排队中：${stats.queued} | 已完成：${stats.completed}`;
}

/**
 * 加载已下载的文件列表
 */
export async function loadDownloadedFiles() {
  const container = document.getElementById('downloaded-files-list');
  if (!container) return;

  // 加载设置获取下载文件夹路径
  let settings = {};
  try {
    if (typeof window.api !== 'undefined') {
      settings = await window.api.loadSettings();
    }
  } catch (e) {
    console.error('加载设置失败:', e);
  }

  if (!settings.downloadFolder) {
    container.innerHTML = `
      <div class="empty-state">
        <p>尚未配置下载文件夹</p>
        <button class="btn" data-action="go-settings">前往设置</button>
      </div>
    `;
    return;
  }

  container.innerHTML = '<div class="loading">正在加载文件列表...</div>';

  try {
    if (typeof window.api === 'undefined') {
      container.innerHTML = '<div class="error">API 未加载</div>';
      return;
    }

    const result = await window.api.listDownloadedFiles(settings.downloadFolder);

    if (!result.success) {
      container.innerHTML = `
        <div class="empty-state">
          <p>${escapeHtml(result.error || '读取文件夹失败')}</p>
        </div>
      `;
      return;
    }

    if (!result.files || result.files.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>下载文件夹为空</p>
          <p>下载的修改器文件将显示在这里</p>
        </div>
      `;
      return;
    }

    renderDownloadedFiles(container, result.files);
  } catch (err) {
    console.error('加载文件列表失败:', err);
    container.innerHTML = '<div class="error">加载文件列表失败</div>';
  }
}

/**
 * 渲染已下载文件列表
 * @param {HTMLElement} container - 容器元素
 * @param {Array} files - 文件数据数组
 */
function renderDownloadedFiles(container, files) {
  container.innerHTML = '';

  // 倒序排列：最新的文件在上面（根据修改时间排序）
  const sortedFiles = [...files].sort((a, b) => {
    const timeA = new Date(a.modified || 0);
    const timeB = new Date(b.modified || 0);
    return timeB - timeA; // 倒序
  });

  sortedFiles.forEach((file) => {
    const item = document.createElement('div');
    item.className = 'tool-item';

    // 使用后端返回的图片，如果没有则使用默认图片
    const imgSrc = file.image || getDefaultImage();
    const actionLabel = file.isExecutable ? '启动' : '打开文件夹';
    const actionType = file.isExecutable ? 'launch' : 'open-folder';
    const folder = file.path.substring(0, Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\')));

    item.innerHTML = `
      <div class="tool-icon">
        <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(file.fileNameWithoutExt)}" loading="lazy">
      </div>
      <div class="tool-info">
        <h4 class="file-title">${escapeHtml(file.fileNameWithoutExt)}</h4>
        <p class="file-size">${formatFileSize(file.size)}</p>
        <p class="file-date">${formatDate(file.modified)}</p>
      </div>
      <div class="tool-actions">
        <button class="btn btn-primary" data-action="${actionType}" data-path="${escapeHtml(file.path)}" data-folder="${escapeHtml(folder)}">${actionLabel}</button>
        <div class="more-actions-wrapper">
          <button class="btn btn-more">•••</button>
          <div class="more-actions-menu">
            <button class="more-menu-item btn-danger" data-action="delete-file" data-path="${escapeHtml(file.path)}" data-name="${escapeHtml(file.fileNameWithoutExt)}">删除</button>
          </div>
        </div>
        ${file.isCompressed ? '<p class="compression-note">压缩包请先解压</p>' : ''}
      </div>
    `;
    container.appendChild(item);
  });
}
